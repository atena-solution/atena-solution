// Dados de demonstração do Atendimento (modo simulado), na empresa demo da Base ("Studio Aurora").

import type { Banco } from '@/lib/dados/banco'
import { juntar } from '@/lib/dados/banco'
import { DEMO } from '@/lib/dados/demo'
import type { RepoBanco } from './repo-banco'
import type { Autor, Contato } from './tipos'
import { treinoPadrao } from './repositorio'

export const PHONE_NUMBER_ID_DEMO = 'PN-DEMO'
export const PHONE_NUMBER_ID_OUTRA = 'PN-DEMO-OUTRA'

export async function semearAtendimentoDemo(b: Banco, repo: RepoBanco, cifrar: (t: string) => string, agora = new Date()) {
  if (await repo.conexao(DEMO.empresaId)) return
  const empresaId = DEMO.empresaId
  // tira as conversas mínimas que a Base pôs pro cartão do Início
  for (const id of ['cv-1', 'cv-2', 'cv-3']) await b.apagar(juntar('empresas', empresaId, 'conversas', id))

  await repo.salvarConexao({
    empresaId,
    phoneNumberId: PHONE_NUMBER_ID_DEMO,
    wabaId: 'WABA-DEMO',
    tokenCifrado: cifrar('TOKEN-SIMULADO'),
    numeroExibicao: '+55 11 98765-4321',
    nomeVerificado: 'Studio Aurora',
    conectadoEm: new Date(agora.getTime() - 7 * 86400000).toISOString(),
    modelos: { lembrete: 'lembrete_horario', recuperacao: 'sentimos_sua_falta', avaliacao: 'pedido_avaliacao', retomada: 'retomar_conversa', idioma: 'pt_BR' },
  })
  await repo.salvarConexao({
    empresaId: DEMO.outraEmpresaId,
    phoneNumberId: PHONE_NUMBER_ID_OUTRA,
    wabaId: 'WABA-OUTRA',
    tokenCifrado: cifrar('TOKEN-OUTRA'),
    conectadoEm: agora.toISOString(),
    modelos: {},
  })
  await repo.salvarTreino({
    ...treinoPadrao(empresaId),
    ligada: true,
    nomeAssistente: 'Aurora',
    tom: 'Acolhedor, leve e direto. Trata por "você".',
    perguntas: [
      { pergunta: 'Vocês aceitam pix ou cartão?', resposta: 'Aceitamos pix, cartão de crédito e débito 😊' },
      { pergunta: 'Tem estacionamento?', resposta: 'Temos convênio com o estacionamento ao lado, 2h grátis.' },
      { pergunta: 'Posso parcelar pacote?', resposta: 'Pacotes podem ser parcelados em até 3x sem juros no cartão.' },
      { pergunta: 'Primeira vez precisa de avaliação?', resposta: 'Na primeira limpeza de pele a Júlia faz uma avaliação rápida, sem custo.' },
    ],
    nuncaDizer: ['desconto sem autorização', 'diagnóstico médico'],
    quandoChamarHumano: ['alergia', 'gestante', 'orçamento de noiva'],
    linkAvaliacao: 'https://g.page/r/studio-aurora/review',
    automacoes: { lembreteVespera: true, lembreteUmaHora: true, recuperarFalta: true, pedirAvaliacao: true },
  })

  const conversa = async (contatoId: string, falas: [Autor, string, number][], extra: Record<string, unknown> = {}) => {
    const c = await b.obter<Contato>(juntar('empresas', empresaId, 'contatos', contatoId))
    if (!c) return
    await b.gravar(juntar('empresas', empresaId, 'atendimento_telefones', c.telefone), { contatoId })
    const conv = await repo.criarConversa(empresaId, {
      contatoId, telefone: c.telefone, nomeContato: c.nome, status: 'aberta', modo: 'ia', precisaHumano: false,
      ultimaMensagem: { texto: '', de: 'cliente', em: agora.toISOString() }, iaDigitando: false, naoLidas: 0, houveHumano: false,
      criadoEm: new Date(agora.getTime() - falas[0][2] * 60000).toISOString(),
    })
    let ultimaCliente: { id: string; em: string } | null = null
    let ultima = { texto: '', de: 'cliente' as Autor, em: '' }
    for (const [de, texto, minAtras] of falas) {
      const em = new Date(agora.getTime() - minAtras * 60000).toISOString()
      const m = await repo.adicionarMensagem(empresaId, { conversaId: conv.id, de, tipo: 'texto', texto, em, status: de === 'cliente' ? undefined : 'lida' })
      if (de === 'cliente') ultimaCliente = { id: m.id, em }
      ultima = { texto, de, em }
    }
    await repo.atualizarConversa(empresaId, conv.id, {
      ultimaMensagem: ultima,
      ultimaMsgClienteId: ultimaCliente?.id,
      ultimaMsgClienteEm: ultimaCliente?.em,
      primeiraRespostaMs: 6000,
      ...extra,
    })
  }

  await conversa('ct-2', [
    ['cliente', 'Oi! Quanto custa a massagem relaxante?', 42],
    ['ia', 'Oi, Fernanda! A massagem relaxante sai por R$ 150,00 e dura 50 min 😊 Quer que eu veja um horário?', 42],
    ['cliente', 'Quero sim, depois de amanhã à tarde', 40],
    ['ia', 'Marquei massagem relaxante com o Caio às 15:00 ✅ Te mando um lembrete na véspera!', 40],
  ])
  await conversa('ct-8', [
    ['cliente', 'Boa tarde', 9],
    ['cliente', 'Fiz uma limpeza semana passada e minha pele ficou toda irritada, quero falar com alguém', 8],
    ['ia', 'Vou chamar alguém da equipe pra te ajudar, só um instante 🙏', 8],
  ], { modo: 'humano', precisaHumano: true, motivoHumano: 'Reclamação', aguardandoDesde: new Date(agora.getTime() - 9 * 60000).toISOString(), naoLidas: 2 })
  await conversa('ct-3', [
    ['cliente', 'Vocês tem estacionamento?', 180],
    ['ia', 'Temos convênio com o estacionamento ao lado, 2h grátis.', 180],
    ['cliente', 'Perfeito, obrigada!', 178],
  ], { status: 'resolvida', resolvidaEm: new Date(agora.getTime() - 170 * 60000).toISOString() })
  await conversa('ct-6', [
    ['cliente', 'Oi, vocês fazem design de sobrancelha com henna?', 2],
  ], { aguardandoDesde: new Date(agora.getTime() - 2 * 60000).toISOString(), naoLidas: 1, modo: 'humano', responsavelUid: 'demo-ana', houveHumano: true })
}
