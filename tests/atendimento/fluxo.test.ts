import { describe, expect, it } from 'vitest'
import { acaoNaConversa, enviarDaEquipe, processarItem, receberWebhook, rodarAutomacoes, rodarAvisos } from '@/lib/atendimento/processar'
import { iaRoteirizada, iaSimulada, texto, usarFerramenta } from '@/lib/integracoes/claude'
import { webhookDeTexto } from '@/lib/integracoes/whatsapp'
import { ambiente, textos } from './ambiente'

const tel = '5511988887777'
const msg = (pnid: string, t: string, wamid?: string) => webhookDeTexto({ phoneNumberId: pnid, de: tel, nome: 'Carlos', texto: t, wamid })

describe('roteamento e deduplicação', () => {
  it('roteia pelo phone_number_id para a empresa certa', async () => {
    const amb = ambiente(iaRoteirizada([]))
    const r1 = await receberWebhook(msg('PN1', 'oi'), amb.deps)
    const r2 = await receberWebhook(msg('PN2', 'oi'), amb.deps)
    expect(r1.itens[0].empresaId).toBe('e1')
    expect(r2.itens[0].empresaId).toBe('e2')
    // mesmo telefone vira contatos diferentes, um em cada empresa
    const c1 = await amb.repo.contatoPorTelefone('e1', tel)
    const c2 = await amb.repo.contatoPorTelefone('e2', tel)
    expect(c1?.id).toBeTruthy()
    expect(c1?.id).not.toBe(c2?.id)
  })
  it('número desconhecido é ignorado', async () => {
    const amb = ambiente(iaRoteirizada([]))
    const r = await receberWebhook(msg('PN_X', 'oi'), amb.deps)
    expect(r.itens).toHaveLength(0)
    expect(r.ignorados[0].motivo).toBe('número não conectado')
  })
  it('ignora repetição pelo wamid', async () => {
    const amb = ambiente(iaRoteirizada([]))
    await receberWebhook(msg('PN1', 'oi', 'wamid.A'), amb.deps)
    const r = await receberWebhook(msg('PN1', 'oi', 'wamid.A'), amb.deps)
    expect(r.ignorados[0].motivo).toBe('repetida')
    const conv = (await amb.repo.listarConversas('e1'))[0]
    expect(await amb.repo.mensagens('e1', conv.id, 50)).toHaveLength(1)
  })
})

describe('rajada', () => {
  it('3 mensagens seguidas → 1 resposta só', async () => {
    const ia = iaRoteirizada([texto('Oi, Carlos! Temos horário sim. Pra qual serviço?')])
    const amb = ambiente(ia)
    const itens = []
    for (const t of ['oi', 'tudo bem?', 'tem horário amanhã?']) {
      itens.push(...(await receberWebhook(msg('PN1', t), amb.deps)).itens)
      amb.avancar(2000)
    }
    amb.avancar(8000)
    const resultados = []
    for (const i of itens) resultados.push(await processarItem(i.itemId, i.empresaId, amb.deps))
    expect(resultados.map((r) => r.acao)).toEqual(['ignorado', 'ignorado', 'respondeu'])
    expect(ia.pedidos).toHaveLength(1)
    // as 3 mensagens chegam juntas pra IA
    expect(ia.pedidos[0].mensagens).toEqual([{ role: 'user', content: 'oi\ntudo bem?\ntem horário amanhã?' }])
    expect(textos(amb.enviadas)).toEqual(['Oi, Carlos! Temos horário sim. Pra qual serviço?'])
  })
  it('processar antes da hora reagenda', async () => {
    const amb = ambiente(iaRoteirizada([]))
    const [i] = (await receberWebhook(msg('PN1', 'oi'), amb.deps)).itens
    const r = await processarItem(i.itemId, i.empresaId, amb.deps)
    expect(r).toEqual({ acao: 'ignorado', motivo: 'cedo demais, reagendado' })
    expect(await amb.repo.filaVencida('9999', 10)).toHaveLength(1)
  })
})

describe('IA marca horário com ferramentas', () => {
  it('ver horários → marcar → confirmar; não deixa marcar ocupado', async () => {
    const ia = iaRoteirizada([
      usarFerramenta('ver_horarios_livres', { servico_id: 'corte', data: '2026-11-03', profissional_id: null }),
      usarFerramenta('marcar_horario', { servico_id: 'corte', inicio: '2026-11-03T13:00:00.000Z', profissional_id: 'joao' }),
      texto('Prontinho, Carlos! Corte marcado terça às 10:00 com João ✅'),
    ])
    const amb = ambiente(ia)
    const [i] = (await receberWebhook(msg('PN1', 'quero cortar amanhã às 10h'), amb.deps)).itens
    amb.avancar(9000)
    const r = await processarItem(i.itemId, i.empresaId, amb.deps)
    expect(r.acao).toBe('respondeu')
    const contato = (await amb.repo.contatoPorTelefone('e1', tel))!
    const ags = await amb.repo.agendamentosDoContato('e1', contato.id)
    expect(ags).toHaveLength(1)
    expect(ags[0]).toMatchObject({ inicio: '2026-11-03T13:00:00.000Z', profissionalId: 'joao', criadoPor: 'ia', status: 'marcado' })
    expect(contato.etapa).toBe('Agendado')
    // a resposta de ver_horarios_livres trouxe o horário certo
    const resultado = ia.pedidos[1].mensagens.at(-1)!.content as { type: string; content: string }[]
    expect(resultado[0].content).toContain('"hora":"10:00"')
  })

  it('outro cliente não consegue o mesmo horário do mesmo profissional', async () => {
    const ia = iaRoteirizada([
      usarFerramenta('marcar_horario', { servico_id: 'barba', inicio: '2026-11-03T13:00:00.000Z', profissional_id: 'joao' }),
      texto('ok'),
      usarFerramenta('marcar_horario', { servico_id: 'barba', inicio: '2026-11-03T13:30:00.000Z', profissional_id: 'joao' }),
      texto('Esse horário já está ocupado. Posso te oferecer outro?'),
    ])
    const amb = ambiente(ia)
    const [a] = (await receberWebhook(webhookDeTexto({ phoneNumberId: 'PN1', de: '551111', texto: 'barba 10h' }), amb.deps)).itens
    const [b] = (await receberWebhook(webhookDeTexto({ phoneNumberId: 'PN1', de: '552222', texto: 'barba 10h30' }), amb.deps)).itens
    amb.avancar(9000)
    await processarItem(a.itemId, 'e1', amb.deps)
    await processarItem(b.itemId, 'e1', amb.deps)
    const ultimo = ia.pedidos[3].mensagens.at(-1)!.content as { content: string; is_error?: boolean }[]
    expect(ultimo[0].is_error).toBe(true)
    expect(ultimo[0].content).toContain('ocupado')
    const todos = await amb.repo.agendamentos('e1', '2026-11-01', '2026-11-30')
    expect(todos).toHaveLength(1)
  })

  it('não remarca/cancela agendamento de outro cliente ou de outra empresa', async () => {
    const amb = ambiente(iaRoteirizada([]))
    const outro = await amb.repo.criarAgendamentoSeLivre('e2', { contatoId: 'x', servicoId: 'corte', profissionalId: 'joao', inicio: '2026-11-03T13:00:00.000Z', fim: '2026-11-03T13:30:00.000Z', status: 'marcado', criadoPor: 'ia', lembretes: {} })
    const ia = iaRoteirizada([usarFerramenta('cancelar', { agendamento_id: outro!.id, motivo: 'teste' }), texto('não achei')])
    amb.deps.ia = ia
    const [i] = (await receberWebhook(msg('PN1', 'cancela meu horário'), amb.deps)).itens
    amb.avancar(9000)
    await processarItem(i.itemId, 'e1', amb.deps)
    const res = ia.pedidos[1].mensagens.at(-1)!.content as { content: string; is_error?: boolean }[]
    expect(res[0].is_error).toBe(true)
    expect((await amb.repo.agendamento('e2', outro!.id))?.status).toBe('marcado')
  })
})

describe('passar para humano', () => {
  it('reclamação vai direto pra equipe, sem chamar a IA', async () => {
    const ia = iaRoteirizada([])
    const amb = ambiente(ia)
    const [i] = (await receberWebhook(msg('PN1', 'que absurdo, fui muito mal atendido'), amb.deps)).itens
    amb.avancar(9000)
    const r = await processarItem(i.itemId, 'e1', amb.deps)
    expect(r).toEqual({ acao: 'humano', motivo: 'Reclamação' })
    expect(ia.pedidos).toHaveLength(0)
    const conv = (await amb.repo.listarConversas('e1'))[0]
    expect(conv).toMatchObject({ modo: 'humano', precisaHumano: true, motivoHumano: 'Reclamação' })
    expect(conv.aguardandoDesde).toBeTruthy()
  })
  it('a IA pode chamar humano pela ferramenta; depois fica quieta', async () => {
    const ia = iaRoteirizada([usarFerramenta('passar_para_humano', { motivo: 'Pergunta sobre convênio' }), texto('Vou chamar alguém da equipe 🙏')])
    const amb = ambiente(ia)
    const [i] = (await receberWebhook(msg('PN1', 'aceita convênio X?'), amb.deps)).itens
    amb.avancar(9000)
    expect((await processarItem(i.itemId, 'e1', amb.deps)).acao).toBe('humano')
    const [j] = (await receberWebhook(msg('PN1', 'e aí?'), amb.deps)).itens
    amb.avancar(9000)
    expect(await processarItem(j.itemId, 'e1', amb.deps)).toEqual({ acao: 'ignorado', motivo: 'equipe assumiu' })
  })
  it('IA fora do ar → mensagem educada e equipe chamada', async () => {
    const amb = ambiente({ async criar() { throw new Error('529 overloaded') } })
    const [i] = (await receberWebhook(msg('PN1', 'oi'), amb.deps)).itens
    amb.avancar(9000)
    expect((await processarItem(i.itemId, 'e1', amb.deps)).acao).toBe('humano')
    expect(textos(amb.enviadas)[0]).toContain('equipe')
  })
})

describe('equipe na caixa de entrada', () => {
  it('assumir pausa a IA; devolver faz a IA responder quem espera', async () => {
    const ia = iaRoteirizada([texto('Oi! Como posso ajudar?')])
    const amb = ambiente(ia)
    const [i] = (await receberWebhook(msg('PN1', 'oi'), amb.deps)).itens
    const conv = (await amb.repo.listarConversas('e1'))[0]
    await acaoNaConversa('e1', conv.id, 'u1', 'assumir', amb.deps)
    amb.avancar(9000)
    expect((await processarItem(i.itemId, 'e1', amb.deps)).acao).toBe('ignorado')
    await acaoNaConversa('e1', conv.id, 'u1', 'devolver', amb.deps)
    expect(textos(amb.enviadas)).toEqual(['Oi! Como posso ajudar?'])
  })
  it('equipe responde em texto livre na janela; fora dela usa o modelo de retomada', async () => {
    const amb = ambiente(iaRoteirizada([]))
    await receberWebhook(msg('PN1', 'oi'), amb.deps)
    const conv = (await amb.repo.listarConversas('e1'))[0]
    const r = await enviarDaEquipe('e1', conv.id, 'u1', { texto: 'Oi Carlos, aqui é o Lincoln' }, amb.deps)
    expect(r.ok).toBe(true)
    expect(amb.enviadas.at(-1)!.conteudo).toEqual({ tipo: 'texto', texto: 'Oi Carlos, aqui é o Lincoln' })
    const depois = await amb.repo.conversa('e1', conv.id)
    expect(depois).toMatchObject({ modo: 'humano', responsavelUid: 'u1', houveHumano: true, aguardandoDesde: null })
    amb.avancar(25 * 3600_000)
    await enviarDaEquipe('e1', conv.id, 'u1', { texto: 'Ainda precisa?' }, amb.deps)
    expect(amb.enviadas.at(-1)!.conteudo).toMatchObject({ tipo: 'modelo', nome: 'retomada', parametros: ['Ainda precisa?'] })
  })
  it('equipe de uma empresa não acessa conversa de outra', async () => {
    const amb = ambiente(iaRoteirizada([]))
    await receberWebhook(msg('PN2', 'oi'), amb.deps)
    const convE2 = (await amb.repo.listarConversas('e2'))[0]
    const r = await enviarDaEquipe('e1', convE2.id, 'u1', { texto: 'invasão' }, amb.deps)
    expect(r).toEqual({ ok: false, erro: 'Conversa não encontrada.' })
    expect(await acaoNaConversa('e1', convE2.id, 'u1', 'resolver', amb.deps)).toBe(false)
    expect(await amb.repo.listarConversas('e1')).toHaveLength(0)
  })
  it('resolver e cliente voltar reabre a conversa com a IA', async () => {
    const amb = ambiente(iaRoteirizada([]))
    await receberWebhook(msg('PN1', 'oi'), amb.deps)
    const conv = (await amb.repo.listarConversas('e1'))[0]
    await acaoNaConversa('e1', conv.id, 'u1', 'assumir', amb.deps)
    await acaoNaConversa('e1', conv.id, 'u1', 'resolver', amb.deps)
    expect((await amb.repo.conversa('e1', conv.id))?.status).toBe('resolvida')
    await receberWebhook(msg('PN1', 'voltei'), amb.deps)
    expect(await amb.repo.conversa('e1', conv.id)).toMatchObject({ status: 'aberta', modo: 'ia', naoLidas: 1 })
  })
})

describe('cron: lembretes, confirmação e avisos', () => {
  it('manda lembrete da véspera uma vez e o "SIM" confirma sem IA', async () => {
    const ia = iaRoteirizada([])
    const amb = ambiente(ia, new Date('2026-11-02T16:00:00Z')) // seg 13:00
    await receberWebhook(msg('PN1', 'oi'), amb.deps)
    const contato = (await amb.repo.contatoPorTelefone('e1', tel))!
    const ag = await amb.repo.criarAgendamentoSeLivre('e1', { contatoId: contato.id, servicoId: 'corte', profissionalId: 'joao', inicio: '2026-11-03T15:00:00.000Z', fim: '2026-11-03T15:30:00.000Z', status: 'marcado', criadoPor: 'u', lembretes: {}, criadoEm: '2026-10-20T00:00:00.000Z' })
    expect((await rodarAutomacoes('e1', amb.deps)).enviadas).toBe(1)
    expect((await rodarAutomacoes('e1', amb.deps)).enviadas).toBe(0)
    expect(textos(amb.enviadas)[0]).toContain('SIM')
    const r = await receberWebhook(msg('PN1', 'Sim!'), amb.deps)
    expect(r.itens).toHaveLength(0)
    expect((await amb.repo.agendamento('e1', ag!.id))?.status).toBe('confirmado')
    expect(textos(amb.enviadas).at(-1)).toContain('Confirmado')
    expect(ia.pedidos).toHaveLength(0)
  })
  it('avisa a equipe quando o cliente espera humano', async () => {
    const amb = ambiente(iaRoteirizada([]))
    const avisos: string[][] = []
    amb.deps.enviarPush = async (p) => { avisos.push(p.uids) }
    const [i] = (await receberWebhook(msg('PN1', 'quero falar com um atendente'), amb.deps)).itens
    amb.avancar(9000)
    await processarItem(i.itemId, 'e1', amb.deps)
    expect(await rodarAvisos('e1', amb.deps)).toBe(0)
    amb.avancar(6 * 60_000)
    expect(await rodarAvisos('e1', amb.deps)).toBe(1)
    expect(avisos).toEqual([['dono-e1']])
    expect(await rodarAvisos('e1', amb.deps)).toBe(0)
  })
})

describe('IA simulada (SIMULAR=1)', () => {
  it('conversa de ponta a ponta: preço, horários e marcação', async () => {
    const amb = ambiente(iaSimulada())
    const falar = async (t: string) => {
      const [i] = (await receberWebhook(msg('PN1', t), amb.deps)).itens
      amb.avancar(9000)
      await processarItem(i.itemId, 'e1', amb.deps)
      return textos(amb.enviadas.splice(0)).join('\n')
    }
    expect(await falar('Vocês aceitam pix?')).toBe('Aceitamos pix, cartão e dinheiro.')
    expect(await falar('quanto custa a barba?')).toContain('R$ 40,00')
    expect(await falar('tem horário amanhã pra corte?')).toMatch(/Tenho .*Qual fica melhor/)
    expect(await falar('pode ser amanhã às 10:00 o corte')).toContain('Prontinho')
    const contato = (await amb.repo.contatoPorTelefone('e1', tel))!
    expect(await amb.repo.agendamentosDoContato('e1', contato.id)).toHaveLength(1)
  })
})
