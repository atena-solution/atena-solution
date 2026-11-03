// Fluxo do Atendimento: webhook → conversa → fila → IA → WhatsApp. E as ações da equipe e do cron.
// Tudo recebe as dependências (repo, IA, canal) para dar pra testar sem internet.

import { medirIA, type ClienteIA } from '@/lib/integracoes/claude'
import type { ConteudoEnvio, Credenciais, EventoMensagem, ResultadoEnvio } from '@/lib/integracoes/whatsapp'
import { lerWebhook } from '@/lib/integracoes/whatsapp'
import type { RepoAtendimento } from './repositorio'
import { ETAPA, type Agendamento, type Autor, type Contato, type Conversa, type Mensagem, type TipoMensagem } from './tipos'
import { decidirRajada, ESPERA_RAJADA_MS } from './rajada'
import { detectarAssuntoSensivel, interpretarConfirmacao, primeiroNome } from './regras'
import { montarMensagens } from './contexto'
import { responder, FRASE_HUMANO } from './cerebro'
import { agendamentoParaConfirmar, decidirAutomacoes } from './automacoes'
import { decidirAvisos } from './avisos'
import { formaDeEnvio } from './janela'
import { DIA, descreverInstante } from './tempo'

export interface CanalWhatsApp {
  enviar(cred: Credenciais, para: string, conteudo: ConteudoEnvio): Promise<ResultadoEnvio>
  marcarLidaEDigitando(cred: Credenciais, wamid: string): Promise<void>
}

export interface Deps {
  repo: RepoAtendimento
  ia: ClienteIA
  canal: CanalWhatsApp
  /** Decifra o token guardado. */
  decifrar: (cifrado: string) => string
  agora: () => Date
  /** Transcreve áudio (Gemini — módulo do Coach). Opcional: sem ele a IA só sabe que veio um áudio. */
  transcrever?: (p: { empresaId: string; midiaId: string; mime?: string; token: string }) => Promise<string | null>
  /** Plano: a aba Atendimento pode agir agora? (teste/pago/carência). Sem ele, libera (testes antigos). */
  acessoAba?: (empresaId: string, conversaId?: string) => Promise<{ permitido: boolean; mensagem?: string }>
  /** Registra tokens gastos pela IA (custo no /admin). */
  registrarUso?: (empresaId: string, modelo: string, uso: { entrada?: number; saida?: number; cacheLeitura?: number; segundosAudio?: number }) => Promise<void>
  /** Envia web push (opcional). */
  enviarPush?: (p: { empresaId: string; uids: string[]; titulo: string; corpo: string; url: string }) => Promise<void>
}

const TIPO: Record<EventoMensagem['tipoMsg'], TipoMensagem> = { texto: 'texto', audio: 'audio', imagem: 'imagem', botao: 'botao', outro: 'texto' }

async function credenciais(deps: Deps, empresaId: string): Promise<Credenciais | null> {
  const c = await deps.repo.conexao(empresaId)
  if (!c) return null
  return { phoneNumberId: c.phoneNumberId, token: deps.decifrar(c.tokenCifrado) }
}

function resumo(t: string) {
  return t.length > 120 ? t.slice(0, 117) + '…' : t
}

async function registrarSaida(
  deps: Deps,
  empresaId: string,
  conversa: Conversa,
  de: Autor,
  texto: string,
  r: ResultadoEnvio,
  extra: Partial<Mensagem> = {},
): Promise<Mensagem> {
  const em = deps.agora().toISOString()
  return deps.repo.adicionarMensagem(empresaId, {
    conversaId: conversa.id,
    de,
    tipo: 'texto',
    texto,
    em,
    wamid: r.wamid,
    status: r.ok ? 'enviada' : 'falhou',
    ...extra,
  })
}

// ---------- 1. Webhook ----------

export interface ResultadoWebhook {
  itens: { empresaId: string; itemId: string; conversaId: string }[]
  ignorados: { motivo: string; wamid?: string }[]
}

export async function receberWebhook(corpo: unknown, deps: Deps): Promise<ResultadoWebhook> {
  const saida: ResultadoWebhook = { itens: [], ignorados: [] }
  for (const ev of lerWebhook(corpo)) {
    const empresaId = await deps.repo.empresaPorPhoneNumberId(ev.phoneNumberId)
    if (!empresaId) {
      saida.ignorados.push({ motivo: 'número não conectado', wamid: ev.wamid })
      continue
    }
    if (ev.tipo === 'status') {
      const mapa = { sent: 'enviada', delivered: 'entregue', read: 'lida', failed: 'falhou' } as const
      await deps.repo.atualizarStatusPorWamid(empresaId, ev.wamid, mapa[ev.status] ?? 'enviada')
      continue
    }
    if (!(await deps.repo.marcarWamid(empresaId, ev.wamid))) {
      saida.ignorados.push({ motivo: 'repetida', wamid: ev.wamid })
      continue
    }
    const item = await receberMensagem(empresaId, ev, deps)
    if (item) saida.itens.push(item)
  }
  return saida
}

async function receberMensagem(empresaId: string, ev: EventoMensagem, deps: Deps) {
  const agora = deps.agora()
  const agoraISO = agora.toISOString()
  const repo = deps.repo

  let contato = await repo.contatoPorTelefone(empresaId, ev.de)
  if (!contato) {
    contato = await repo.criarContato(empresaId, {
      nome: ev.nome ?? '',
      telefone: ev.de,
      origem: 'WhatsApp',
      etapa: ETAPA.novo,
      etiquetas: [],
      ultimaInteracaoEm: agoraISO,
      criadoEm: agoraISO,
      campos: {},
    })
  } else {
    await repo.atualizarContato(empresaId, contato.id, { ultimaInteracaoEm: agoraISO, ...(!contato.nome && ev.nome ? { nome: ev.nome } : {}) })
  }

  let texto = ev.texto
  if (ev.tipoMsg === 'audio' && ev.midiaId && deps.transcrever) {
    const cred = await credenciais(deps, empresaId)
    const t = cred ? await deps.transcrever({ empresaId, midiaId: ev.midiaId, mime: ev.mime, token: cred.token }).catch(() => null) : null
    if (t) texto = t
  }

  let conversa = await repo.conversaDoContato(empresaId, contato.id)
  if (!conversa) {
    conversa = await repo.criarConversa(empresaId, {
      contatoId: contato.id,
      telefone: contato.telefone,
      nomeContato: contato.nome || ev.nome || '',
      status: 'aberta',
      modo: 'ia',
      precisaHumano: false,
      ultimaMensagem: { texto: '', de: 'cliente', em: agoraISO },
      iaDigitando: false,
      naoLidas: 0,
      houveHumano: false,
      criadoEm: agoraISO,
    })
    await repo.registrarAtividade(empresaId, { contatoId: contato.id, tipo: 'mensagem', resumo: 'Começou conversa no WhatsApp', quando: agoraISO })
  } else if (conversa.status === 'resolvida') {
    await repo.registrarAtividade(empresaId, { contatoId: contato.id, tipo: 'mensagem', resumo: 'Voltou a chamar no WhatsApp', quando: agoraISO })
  }

  const msg = await repo.adicionarMensagem(empresaId, {
    conversaId: conversa.id,
    de: 'cliente',
    tipo: TIPO[ev.tipoMsg],
    texto,
    midiaId: ev.midiaId,
    wamid: ev.wamid,
    em: agoraISO,
  })
  const reaberta = conversa.status === 'resolvida'
  await repo.atualizarConversa(empresaId, conversa.id, {
    status: 'aberta',
    ...(reaberta ? { modo: 'ia', precisaHumano: false, motivoHumano: '', houveHumano: false, resolvidaEm: '', primeiraRespostaMs: undefined } : {}),
    nomeContato: conversa.nomeContato || contato.nome || ev.nome || '',
    ultimaMensagem: { texto: resumo(texto || (ev.tipoMsg === 'audio' ? '🎤 Áudio' : ev.tipoMsg === 'imagem' ? '📷 Foto' : '')), de: 'cliente', em: agoraISO },
    ultimaMsgClienteId: msg.id,
    ultimaMsgClienteEm: agoraISO,
    aguardandoDesde: conversa.aguardandoDesde && !reaberta ? conversa.aguardandoDesde : agoraISO,
    naoLidas: (reaberta ? 0 : conversa.naoLidas) + 1,
  })

  // "SIM" de confirmação de lembrete: resolve na hora, sem IA.
  if (interpretarConfirmacao(texto) === 'sim' && conversa.modo === 'ia') {
    const ags = await repo.agendamentosDoContato(empresaId, contato.id)
    const alvo = agendamentoParaConfirmar(ags, contato.id, agora)
    if (alvo && (await repo.automacaoFeita(empresaId, `lembrete_vespera:${alvo.id}`))) {
      await confirmarPorResposta(empresaId, { ...conversa, ultimaMsgClienteEm: agoraISO }, contato, alvo, deps)
      return null
    }
  }

  const item = await repo.enfileirar({
    empresaId,
    conversaId: conversa.id,
    gatilhoMsgId: msg.id,
    processarApos: new Date(agora.getTime() + ESPERA_RAJADA_MS).toISOString(),
  })
  return { empresaId, itemId: item.id, conversaId: conversa.id }
}

async function confirmarPorResposta(empresaId: string, conversa: Conversa, contato: Contato, ag: Agendamento, deps: Deps) {
  const empresa = await deps.repo.empresa(empresaId)
  const servicos = await deps.repo.servicos(empresaId)
  const nome = primeiroNome(contato.nome)
  const texto = `Confirmado${nome ? `, ${nome}` : ''}! ✅ ${servicos.find((s) => s.id === ag.servicoId)?.nome ?? 'Seu horário'} ${descreverInstante(new Date(ag.inicio), empresa?.fuso ?? 'America/Sao_Paulo')}. Até lá!`
  await deps.repo.atualizarAgendamento(empresaId, ag.id, { status: 'confirmado' })
  await deps.repo.registrarAtividade(empresaId, { contatoId: contato.id, tipo: 'agendamento', resumo: 'Cliente confirmou pelo WhatsApp', quando: deps.agora().toISOString(), porIA: true })
  const cred = await credenciais(deps, empresaId)
  const r = cred ? await deps.canal.enviar(cred, contato.telefone, { tipo: 'texto', texto }) : { ok: false, erro: 'sem conexão' }
  await registrarSaida(deps, empresaId, conversa, 'ia', texto, r)
  await deps.repo.atualizarConversa(empresaId, conversa.id, {
    aguardandoDesde: null,
    ultimaRespostaEm: deps.agora().toISOString(),
    ultimaMensagem: { texto: resumo(texto), de: 'ia', em: deps.agora().toISOString() },
  })
}

// ---------- 2. Fila: a IA responde ----------

export type ResultadoItem =
  | { acao: 'respondeu'; baloes: string[] }
  | { acao: 'humano'; motivo: string }
  | { acao: 'ignorado'; motivo: string }

export async function processarItem(itemId: string, empresaId: string, deps: Deps): Promise<ResultadoItem> {
  const repo = deps.repo
  if (!(await repo.pegarItem(itemId))) return { acao: 'ignorado', motivo: 'já processado' }
  try {
    return await processar(itemId, empresaId, deps)
  } finally {
    await repo.concluirItem(itemId)
  }
}

async function processar(itemId: string, empresaId: string, deps: Deps): Promise<ResultadoItem> {
  const repo = deps.repo
  const dados = await repo.itemFila(itemId)
  if (!dados || dados.empresaId !== empresaId) return { acao: 'ignorado', motivo: 'item não encontrado' }
  const conversa = await repo.conversa(empresaId, dados.conversaId)
  if (!conversa) return { acao: 'ignorado', motivo: 'conversa não existe' }

  const decisao = decidirRajada({
    gatilhoMsgId: dados.gatilhoMsgId,
    ultimaMsgClienteId: conversa.ultimaMsgClienteId,
    ultimaMsgClienteEm: conversa.ultimaMsgClienteEm,
    aguardandoDesde: conversa.aguardandoDesde,
    agora: deps.agora(),
  })
  if (decisao.acao === 'descartar') return { acao: 'ignorado', motivo: decisao.motivo }
  if (decisao.acao === 'esperar') {
    await repo.enfileirar({ empresaId, conversaId: conversa.id, gatilhoMsgId: dados.gatilhoMsgId, processarApos: new Date(deps.agora().getTime() + decisao.ms).toISOString() })
    return { acao: 'ignorado', motivo: 'cedo demais, reagendado' }
  }
  return responderConversa(empresaId, conversa, deps)
}

export async function responderConversa(empresaId: string, conversa: Conversa, deps: Deps, opcoes: { forcar?: boolean } = {}): Promise<ResultadoItem> {
  const repo = deps.repo
  const treino = await repo.treino(empresaId)
  if (!treino.ligada && !opcoes.forcar) return { acao: 'ignorado', motivo: 'IA desligada' }
  if (conversa.modo === 'humano') return { acao: 'ignorado', motivo: 'equipe assumiu' }
  if (conversa.status !== 'aberta') return { acao: 'ignorado', motivo: 'conversa resolvida' }
  if (deps.acessoAba) {
    const acesso = await deps.acessoAba(empresaId, conversa.id)
    if (!acesso.permitido) return { acao: 'ignorado', motivo: acesso.mensagem ?? 'fora do plano' }
  }

  const [empresa, contato, servicos, profissionais, historico] = await Promise.all([
    repo.empresa(empresaId),
    repo.contato(empresaId, conversa.contatoId),
    repo.servicos(empresaId),
    repo.profissionais(empresaId),
    repo.mensagens(empresaId, conversa.id, 30),
  ])
  if (!empresa || !contato) return { acao: 'ignorado', motivo: 'dados faltando' }
  const cred = await credenciais(deps, empresaId)
  if (!cred) return { acao: 'ignorado', motivo: 'WhatsApp não conectado' }

  // o que o cliente falou desde a última resposta
  const ultimasDoCliente: string[] = []
  for (let i = historico.length - 1; i >= 0 && historico[i].de === 'cliente'; i--) ultimasDoCliente.unshift(historico[i].texto)
  const sensivel = detectarAssuntoSensivel(ultimasDoCliente.join(' '), treino.quandoChamarHumano)

  const agora = deps.agora()
  const enviarBaloes = async (baloes: string[]) => {
    let ultimo: Mensagem | null = null
    for (const b of baloes) {
      const r = await deps.canal.enviar(cred, conversa.telefone, { tipo: 'texto', texto: b })
      ultimo = await registrarSaida(deps, empresaId, conversa, 'ia', b, r)
    }
    return ultimo
  }
  const marcarRespondido = async (patch: Partial<Conversa>, ultimoTexto: string) => {
    const agoraISO = deps.agora().toISOString()
    await repo.atualizarConversa(empresaId, conversa.id, {
      iaDigitando: false,
      ultimaRespostaEm: agoraISO,
      ultimaMensagem: { texto: resumo(ultimoTexto), de: 'ia', em: agoraISO },
      ...(conversa.primeiraRespostaMs === undefined && conversa.aguardandoDesde
        ? { primeiraRespostaMs: Date.parse(agoraISO) - Date.parse(conversa.aguardandoDesde) }
        : {}),
      ...patch,
    })
    const atual = await repo.contato(empresaId, contato.id)
    if (atual?.etapa === ETAPA.novo) await repo.atualizarContato(empresaId, contato.id, { etapa: ETAPA.emConversa })
  }

  if (sensivel) {
    await enviarBaloes([FRASE_HUMANO])
    await marcarRespondido({ modo: 'humano', precisaHumano: true, motivoHumano: sensivel, aguardandoDesde: conversa.aguardandoDesde ?? agora.toISOString() }, FRASE_HUMANO)
    await repo.registrarAtividade(empresaId, { contatoId: contato.id, tipo: 'nota', resumo: `Passou pra equipe: ${sensivel}`, quando: agora.toISOString(), porIA: true })
    return { acao: 'humano', motivo: sensivel }
  }

  await repo.atualizarConversa(empresaId, conversa.id, { iaDigitando: true })
  const gatilho = [...historico].reverse().find((m) => m.de === 'cliente' && m.wamid)
  if (gatilho?.wamid) await deps.canal.marcarLidaEDigitando(cred, gatilho.wamid)

  const agendamentosContato = await repo.agendamentosDoContato(empresaId, contato.id)
  const resposta = await responder({
    ia: deps.registrarUso ? medirIA(deps.ia, (m, u) => deps.registrarUso!(empresaId, m, u)) : deps.ia,
    treino,
    mensagens: montarMensagens(historico),
    ctx: { repo, empresa, servicos, profissionais, contato, conversa, agora },
    agendamentosContato,
  })

  // chegou mensagem nova enquanto a IA pensava? a próxima rodada responde tudo junto.
  const atual = await repo.conversa(empresaId, conversa.id)
  if (atual && atual.ultimaMsgClienteId !== conversa.ultimaMsgClienteId) {
    await repo.atualizarConversa(empresaId, conversa.id, { iaDigitando: false })
    return { acao: 'ignorado', motivo: 'cliente mandou mais mensagens' }
  }
  if (atual && atual.modo === 'humano') {
    await repo.atualizarConversa(empresaId, conversa.id, { iaDigitando: false })
    return { acao: 'ignorado', motivo: 'equipe assumiu enquanto a IA pensava' }
  }

  const humano = resposta.efeitos.find((e) => e.tipo === 'humano')
  if (resposta.baloes.length) await enviarBaloes(resposta.baloes)
  if (humano && humano.tipo === 'humano') {
    await marcarRespondido({ modo: 'humano', precisaHumano: true, motivoHumano: humano.motivo, aguardandoDesde: conversa.aguardandoDesde ?? agora.toISOString() }, resposta.baloes.at(-1) ?? FRASE_HUMANO)
    await repo.registrarAtividade(empresaId, { contatoId: contato.id, tipo: 'nota', resumo: `Passou pra equipe: ${humano.motivo}`, quando: agora.toISOString(), porIA: true })
    return { acao: 'humano', motivo: humano.motivo }
  }
  const dado = resposta.efeitos.find((e) => e.tipo === 'dado' && e.campo === 'nome')
  await marcarRespondido({ aguardandoDesde: null, ...(dado && dado.tipo === 'dado' ? { nomeContato: dado.valor } : {}) }, resposta.baloes.at(-1) ?? '')
  return { acao: 'respondeu', baloes: resposta.baloes }
}

/** Processa o que venceu na fila (rede de segurança do cron). */
export async function processarFila(deps: Deps, limite = 50): Promise<number> {
  const itens = await deps.repo.filaVencida(deps.agora().toISOString(), limite)
  for (const i of itens) await processarItem(i.id, i.empresaId, deps).catch(() => undefined)
  return itens.length
}

// ---------- 3. Equipe ----------

export type ResultadoEquipe = { ok: true; mensagem: Mensagem } | { ok: false; erro: string }

export async function enviarDaEquipe(
  empresaId: string,
  conversaId: string,
  uid: string,
  conteudo: { texto: string } | { midia: 'imagem' | 'audio'; midiaId: string; legenda?: string; midiaUrl?: string },
  deps: Deps,
): Promise<ResultadoEquipe> {
  const repo = deps.repo
  const conversa = await repo.conversa(empresaId, conversaId)
  if (!conversa) return { ok: false, erro: 'Conversa não encontrada.' }
  const conexao = await repo.conexao(empresaId)
  const cred = await credenciais(deps, empresaId)
  if (!cred || !conexao) return { ok: false, erro: 'Conecte o WhatsApp primeiro.' }
  const agora = deps.agora()
  const forma = formaDeEnvio(conversa.ultimaMsgClienteEm, agora, conexao.modelos.retomada)
  if (forma.forma === 'bloqueado') return { ok: false, erro: forma.motivo }

  const texto = 'texto' in conteudo ? conteudo.texto.trim() : conteudo.legenda ?? ''
  if ('texto' in conteudo && !texto) return { ok: false, erro: 'Escreva a mensagem.' }
  if (forma.forma === 'modelo' && !('texto' in conteudo)) return { ok: false, erro: 'Fora da janela de 24h só dá pra mandar o modelo de texto.' }

  const envio: ConteudoEnvio =
    forma.forma === 'modelo'
      ? { tipo: 'modelo', nome: forma.modelo, idioma: conexao.modelos.idioma ?? 'pt_BR', parametros: [texto] }
      : 'texto' in conteudo
        ? { tipo: 'texto', texto }
        : conteudo.midia === 'imagem'
          ? { tipo: 'imagem', midiaId: conteudo.midiaId, legenda: conteudo.legenda }
          : { tipo: 'audio', midiaId: conteudo.midiaId }
  const r = await deps.canal.enviar(cred, conversa.telefone, envio)
  if (!r.ok) return { ok: false, erro: r.janelaFechada ? 'A janela de 24h fechou. Use um modelo aprovado.' : `WhatsApp recusou: ${r.erro}` }
  const tipo: TipoMensagem = forma.forma === 'modelo' ? 'modelo' : 'texto' in conteudo ? 'texto' : conteudo.midia
  const mensagem = await registrarSaida(deps, empresaId, conversa, 'equipe', texto, r, {
    tipo,
    porUid: uid,
    ...('midiaId' in conteudo ? { midiaId: conteudo.midiaId, midiaUrl: conteudo.midiaUrl } : {}),
  })
  const agoraISO = agora.toISOString()
  await repo.atualizarConversa(empresaId, conversaId, {
    modo: 'humano',
    responsavelUid: conversa.responsavelUid ?? uid,
    houveHumano: true,
    precisaHumano: false,
    aguardandoDesde: null,
    avisadoEm: null,
    naoLidas: 0,
    ultimaRespostaEm: agoraISO,
    ultimaMensagem: { texto: resumo(texto || (tipo === 'audio' ? '🎤 Áudio' : '📷 Foto')), de: 'equipe', em: agoraISO },
    ...(conversa.primeiraRespostaMs === undefined && conversa.aguardandoDesde
      ? { primeiraRespostaMs: agora.getTime() - Date.parse(conversa.aguardandoDesde) }
      : {}),
  })
  return { ok: true, mensagem }
}

export type AcaoConversa = 'assumir' | 'devolver' | 'resolver' | 'reabrir' | 'lida'

/**
 * Manda um texto da equipe para um CONTATO (ex.: follow-up do Coach) pelo WhatsApp da empresa.
 * Abre a conversa se ainda não existir. Respeita a janela de 24h: fora dela usa o modelo de retomada
 * aprovado (ou recusa com o motivo). A conversa fica com a equipe (a IA não atropela o vendedor).
 */
export async function enviarAoContato(empresaId: string, contatoId: string, uid: string, texto: string, deps: Deps): Promise<ResultadoEquipe & { conversaId?: string }> {
  const repo = deps.repo
  const contato = await repo.contato(empresaId, contatoId)
  if (!contato) return { ok: false, erro: 'Contato não encontrado.' }
  if (!(await repo.conexao(empresaId))) return { ok: false, erro: 'Conecte o WhatsApp primeiro.' }
  let conversa = await repo.conversaDoContato(empresaId, contato.id)
  if (!conversa) {
    const agoraISO = deps.agora().toISOString()
    conversa = await repo.criarConversa(empresaId, {
      contatoId: contato.id,
      telefone: contato.telefone,
      nomeContato: contato.nome,
      status: 'aberta',
      modo: 'humano',
      precisaHumano: false,
      ultimaMensagem: { texto: '', de: 'equipe', em: agoraISO },
      iaDigitando: false,
      naoLidas: 0,
      houveHumano: true,
      criadoEm: agoraISO,
    })
  }
  const r = await enviarDaEquipe(empresaId, conversa.id, uid, { texto }, deps)
  return { ...r, conversaId: conversa.id }
}

export async function acaoNaConversa(empresaId: string, conversaId: string, uid: string, acao: AcaoConversa, deps: Deps): Promise<boolean> {
  const repo = deps.repo
  const c = await repo.conversa(empresaId, conversaId)
  if (!c) return false
  const agoraISO = deps.agora().toISOString()
  switch (acao) {
    case 'assumir':
      await repo.atualizarConversa(empresaId, conversaId, { modo: 'humano', responsavelUid: uid, houveHumano: true, precisaHumano: false, iaDigitando: false })
      await repo.registrarAtividade(empresaId, { contatoId: c.contatoId, tipo: 'nota', resumo: 'Equipe assumiu a conversa', quando: agoraISO, porUid: uid })
      break
    case 'devolver':
      await repo.atualizarConversa(empresaId, conversaId, { modo: 'ia', precisaHumano: false, motivoHumano: '' })
      if (c.aguardandoDesde) {
        // cliente estava esperando: a IA responde já
        await responderConversa(empresaId, { ...c, modo: 'ia', precisaHumano: false }, deps)
      }
      break
    case 'resolver':
      await repo.atualizarConversa(empresaId, conversaId, { status: 'resolvida', resolvidaEm: agoraISO, precisaHumano: false, aguardandoDesde: null, iaDigitando: false, naoLidas: 0 })
      break
    case 'reabrir':
      await repo.atualizarConversa(empresaId, conversaId, { status: 'aberta', resolvidaEm: '' })
      break
    case 'lida':
      await repo.atualizarConversa(empresaId, conversaId, { naoLidas: 0 })
      break
  }
  return true
}

// ---------- 4. Cron: lembretes e avisos ----------

export async function rodarAutomacoes(empresaId: string, deps: Deps) {
  const repo = deps.repo
  const agora = deps.agora()
  const [empresa, treino, conexao, servicos] = await Promise.all([
    repo.empresa(empresaId),
    repo.treino(empresaId),
    repo.conexao(empresaId),
    repo.servicos(empresaId),
  ])
  const cred = await credenciais(deps, empresaId)
  if (!empresa || !conexao || !cred) return { enviadas: 0, puladas: [] as { chave: string; motivo: string }[] }
  if (deps.acessoAba && !(await deps.acessoAba(empresaId)).permitido) return { enviadas: 0, puladas: [{ chave: '*', motivo: 'fora do plano' }] }

  const agendamentos = await repo.agendamentos(empresaId, new Date(agora.getTime() - 3 * DIA).toISOString(), new Date(agora.getTime() + 2 * DIA).toISOString())
  const contatos = new Map<string, Contato>()
  const ultima = new Map<string, string | undefined>()
  const conversas = new Map<string, Conversa | null>()
  for (const id of new Set(agendamentos.map((a) => a.contatoId))) {
    const c = await repo.contato(empresaId, id)
    if (c) contatos.set(id, c)
    const conv = await repo.conversaDoContato(empresaId, id)
    conversas.set(id, conv)
    ultima.set(id, conv?.ultimaMsgClienteEm)
  }
  const tipos = ['lembrete_vespera', 'lembrete_1h', 'recuperar_falta', 'pedir_avaliacao']
  const jaFeitas = await repo.automacoesFeitas(empresaId, agendamentos.flatMap((a) => tipos.map((t) => `${t}:${a.id}`)))
  const { acoes, puladas } = decidirAutomacoes({
    agora,
    fuso: empresa.fuso,
    nomeEmpresa: empresa.nome,
    agendamentos,
    contatos,
    servicos: new Map(servicos.map((s) => [s.id, s])),
    ultimaMsgClientePorContato: ultima,
    jaFeitas,
    treino,
    modelos: conexao.modelos,
  })

  let enviadas = 0
  for (const a of acoes) {
    // registra antes de enviar: na dúvida, melhor não mandar do que mandar duas vezes
    if (await repo.automacaoFeita(empresaId, a.chave)) continue
    await repo.registrarAutomacao(empresaId, a.chave, { em: agora.toISOString(), forma: a.forma })
    const r = await deps.canal.enviar(cred, a.telefone, a.forma === 'modelo' && a.modelo ? { tipo: 'modelo', ...a.modelo } : { tipo: 'texto', texto: a.texto })
    let conv = conversas.get(a.contatoId) ?? null
    if (!conv) {
      const contato = contatos.get(a.contatoId)!
      conv = await repo.criarConversa(empresaId, {
        contatoId: contato.id,
        telefone: contato.telefone,
        nomeContato: contato.nome,
        status: 'aberta',
        modo: 'ia',
        precisaHumano: false,
        ultimaMensagem: { texto: '', de: 'ia', em: agora.toISOString() },
        iaDigitando: false,
        naoLidas: 0,
        houveHumano: false,
        criadoEm: agora.toISOString(),
      })
      conversas.set(a.contatoId, conv)
    }
    await registrarSaida(deps, empresaId, conv, 'ia', a.texto, r, { tipo: a.forma === 'modelo' ? 'modelo' : 'texto' })
    await repo.atualizarConversa(empresaId, conv.id, {
      ultimaMensagem: { texto: resumo(a.texto), de: 'ia', em: agora.toISOString() },
      ...(conv.status === 'resolvida' && (a.tipo === 'recuperar_falta' || a.tipo === 'lembrete_vespera') ? { status: 'aberta' as const } : {}),
    })
    if (a.tipo === 'lembrete_vespera') await repo.atualizarAgendamento(empresaId, a.agendamentoId, { lembretes: { ...agendamentos.find((x) => x.id === a.agendamentoId)?.lembretes, vesperaEm: agora.toISOString() } })
    if (a.tipo === 'lembrete_1h') await repo.atualizarAgendamento(empresaId, a.agendamentoId, { lembretes: { ...agendamentos.find((x) => x.id === a.agendamentoId)?.lembretes, umaHoraEm: agora.toISOString() } })
    if (r.ok) enviadas++
  }
  return { enviadas, puladas }
}

export async function rodarAvisos(empresaId: string, deps: Deps) {
  const repo = deps.repo
  const [treino, conversas, membros] = await Promise.all([repo.treino(empresaId), repo.listarConversas(empresaId, 300), repo.membros(empresaId)])
  const avisos = decidirAvisos({ conversas, membros, agora: deps.agora(), minutos: treino.avisoHumanoMin || 5 })
  for (const a of avisos) {
    await deps.enviarPush?.({ empresaId, uids: a.uids, titulo: a.titulo, corpo: a.corpo, url: `/atendimento?c=${a.conversaId}` }).catch(() => undefined)
    await repo.atualizarConversa(empresaId, a.conversaId, { avisadoEm: deps.agora().toISOString() })
  }
  return avisos.length
}
