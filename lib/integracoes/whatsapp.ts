// Integração com a Meta WhatsApp Cloud API.
//
// O que a doc oficial diz (consultada em 01/11/2026 — developers.facebook.com/docs/whatsapp/cloud-api):
// - Verificação do webhook (GET): a Meta chama com hub.mode=subscribe, hub.verify_token e hub.challenge;
//   devolver o hub.challenge com 200 se o token bater.
// - Notificações (POST): corpo { object: 'whatsapp_business_account', entry: [{ id: WABA_ID, changes: [{ field: 'messages',
//   value: { messaging_product, metadata: { display_phone_number, phone_number_id }, contacts: [{ profile: { name }, wa_id }],
//   messages: [{ from, id (wamid), timestamp (segundos, string), type, text: { body } | audio: { id, mime_type } |
//   image: { id, mime_type, caption? } | button: { text, payload } | interactive: { type, button_reply|list_reply: { id, title } } }],
//   statuses: [{ id, status: sent|delivered|read|failed, timestamp, recipient_id }] } }] }] }.
// - Assinatura: cabeçalho X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(corpo bruto, App Secret) em hex.
// - Enviar: POST https://graph.facebook.com/{versão}/{phone_number_id}/messages, Authorization: Bearer {token},
//   { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url } }
//   → { messages: [{ id: wamid }] }. Modelo: type 'template', template: { name, language: { code }, components:
//   [{ type: 'body', parameters: [{ type: 'text', text }] }] }. Mídia: type 'image'|'audio', image: { id | link, caption? }.
// - Marcar como lida: POST .../messages { messaging_product, status: 'read', message_id }.
//   Indicador "digitando": mesmo corpo + typing_indicator: { type: 'text' } (lançado em 2025). // CONFIRMAR AO VIVO
// - Mídia recebida: GET /{media_id} → { url, mime_type }; depois GET url com o mesmo Bearer.
// - Upload de mídia: POST /{phone_number_id}/media (multipart: file, type, messaging_product=whatsapp) → { id }.
// - Dados do número: GET /{phone_number_id}?fields=display_phone_number,verified_name.
// Tudo marcado CONFIRMAR AO VIVO até o teste com número real no Mac.

import { createHmac, timingSafeEqual } from 'node:crypto'

export const GRAPH_VERSAO = process.env.WHATSAPP_GRAPH_VERSAO || 'v23.0' // CONFIRMAR AO VIVO (versão atual da Graph API)
const GRAPH = 'https://graph.facebook.com'

export function simulando(): boolean {
  return process.env.SIMULAR === '1'
}

// ---------- Webhook: verificação e assinatura ----------

export function verificarDesafio(params: URLSearchParams, tokenVerificacao: string | undefined): string | null {
  if (!tokenVerificacao) return null
  if (params.get('hub.mode') === 'subscribe' && params.get('hub.verify_token') === tokenVerificacao)
    return params.get('hub.challenge')
  return null
}

export function assinar(corpoBruto: string, segredoApp: string): string {
  return 'sha256=' + createHmac('sha256', segredoApp).update(corpoBruto, 'utf8').digest('hex')
}

export function verificarAssinatura(corpoBruto: string, cabecalho: string | null, segredoApp: string): boolean {
  if (!cabecalho) return false
  const esperado = Buffer.from(assinar(corpoBruto, segredoApp))
  const recebido = Buffer.from(cabecalho)
  return esperado.length === recebido.length && timingSafeEqual(esperado, recebido)
}

// ---------- Webhook: leitura ----------

export interface EventoMensagem {
  tipo: 'mensagem'
  phoneNumberId: string
  wamid: string
  de: string // wa_id (telefone E.164 sem +)
  nome?: string
  em: string // ISO
  tipoMsg: 'texto' | 'audio' | 'imagem' | 'botao' | 'outro'
  texto: string
  midiaId?: string
  mime?: string
}

export interface EventoStatus {
  tipo: 'status'
  phoneNumberId: string
  wamid: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  em: string
  erro?: string
}

export type EventoWhatsApp = EventoMensagem | EventoStatus

export function lerWebhook(corpo: any): EventoWhatsApp[] {
  const eventos: EventoWhatsApp[] = []
  if (!corpo || corpo.object !== 'whatsapp_business_account' || !Array.isArray(corpo.entry)) return eventos
  for (const entry of corpo.entry) {
    for (const change of entry?.changes ?? []) {
      if (change?.field !== 'messages') continue
      const v = change.value ?? {}
      const phoneNumberId: string | undefined = v.metadata?.phone_number_id
      if (!phoneNumberId) continue
      const nomes = new Map<string, string>()
      for (const c of v.contacts ?? []) if (c?.wa_id) nomes.set(c.wa_id, c.profile?.name)
      for (const m of v.messages ?? []) {
        if (!m?.id || !m?.from) continue
        const em = new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString()
        const base = { tipo: 'mensagem' as const, phoneNumberId, wamid: m.id, de: m.from, nome: nomes.get(m.from), em }
        switch (m.type) {
          case 'text':
            eventos.push({ ...base, tipoMsg: 'texto', texto: m.text?.body ?? '' })
            break
          case 'audio':
            eventos.push({ ...base, tipoMsg: 'audio', texto: '', midiaId: m.audio?.id, mime: m.audio?.mime_type })
            break
          case 'image':
            eventos.push({ ...base, tipoMsg: 'imagem', texto: m.image?.caption ?? '', midiaId: m.image?.id, mime: m.image?.mime_type })
            break
          case 'button':
            eventos.push({ ...base, tipoMsg: 'botao', texto: m.button?.text ?? m.button?.payload ?? '' })
            break
          case 'interactive': {
            const r = m.interactive?.button_reply ?? m.interactive?.list_reply
            eventos.push({ ...base, tipoMsg: 'botao', texto: r?.title ?? r?.id ?? '' })
            break
          }
          default:
            eventos.push({ ...base, tipoMsg: 'outro', texto: `[${m.type ?? 'mensagem'} não suportada]` })
        }
      }
      for (const s of v.statuses ?? []) {
        if (!s?.id) continue
        eventos.push({
          tipo: 'status',
          phoneNumberId,
          wamid: s.id,
          status: s.status,
          em: new Date(Number(s.timestamp) * 1000 || Date.now()).toISOString(),
          erro: s.errors?.[0]?.title,
        })
      }
    }
  }
  return eventos
}

/** Monta um corpo de webhook igual ao da Meta (usado no modo simulado e nos testes). */
export function webhookDeTexto(p: { phoneNumberId: string; de: string; nome?: string; texto: string; wamid?: string; em?: Date }) {
  const ts = Math.floor((p.em ?? new Date()).getTime() / 1000)
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_SIMULADA',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '5511000000000', phone_number_id: p.phoneNumberId },
              contacts: [{ profile: { name: p.nome ?? 'Cliente' }, wa_id: p.de }],
              messages: [
                { from: p.de, id: p.wamid ?? `wamid.SIM${ts}${Math.random().toString(36).slice(2, 8)}`, timestamp: String(ts), type: 'text', text: { body: p.texto } },
              ],
            },
          },
        ],
      },
    ],
  }
}

// ---------- Envio ----------

export interface Credenciais {
  phoneNumberId: string
  token: string
}

export type ConteudoEnvio =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'modelo'; nome: string; idioma: string; parametros: string[] }
  | { tipo: 'imagem'; midiaId?: string; link?: string; legenda?: string }
  | { tipo: 'audio'; midiaId?: string; link?: string }

export interface ResultadoEnvio {
  ok: boolean
  wamid?: string
  erro?: string
  /** true quando a Meta recusou por janela de 24h fechada (código 131047). */
  janelaFechada?: boolean
}

export interface EnviadaSimulada {
  para: string
  phoneNumberId: string
  conteudo: ConteudoEnvio
  wamid: string
  em: string
}

// Caixa de saída do modo simulado (por processo).
const g = globalThis as unknown as { __atenaSaidaWhatsApp?: EnviadaSimulada[] }
export function saidaSimulada(): EnviadaSimulada[] {
  return (g.__atenaSaidaWhatsApp ??= [])
}

function corpoEnvio(para: string, c: ConteudoEnvio): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to: para }
  switch (c.tipo) {
    case 'texto':
      return { ...base, type: 'text', text: { body: c.texto, preview_url: /https?:\/\//.test(c.texto) } }
    case 'modelo':
      return {
        ...base,
        type: 'template',
        template: {
          name: c.nome,
          language: { code: c.idioma },
          components: c.parametros.length ? [{ type: 'body', parameters: c.parametros.map((text) => ({ type: 'text', text })) }] : [],
        },
      }
    case 'imagem':
      return { ...base, type: 'image', image: { ...(c.midiaId ? { id: c.midiaId } : { link: c.link }), ...(c.legenda ? { caption: c.legenda } : {}) } }
    case 'audio':
      return { ...base, type: 'audio', audio: c.midiaId ? { id: c.midiaId } : { link: c.link } }
  }
}

export { corpoEnvio as _corpoEnvio }

export async function enviar(cred: Credenciais, para: string, conteudo: ConteudoEnvio): Promise<ResultadoEnvio> {
  if (simulando()) {
    const wamid = `wamid.SAIDA${Date.now()}${Math.random().toString(36).slice(2, 8)}`
    saidaSimulada().push({ para, phoneNumberId: cred.phoneNumberId, conteudo, wamid, em: new Date().toISOString() })
    return { ok: true, wamid }
  }
  try {
    const r = await fetch(`${GRAPH}/${GRAPH_VERSAO}/${cred.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cred.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpoEnvio(para, conteudo)),
    })
    const json = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } }
    if (!r.ok) {
      return { ok: false, erro: json.error?.message ?? `HTTP ${r.status}`, janelaFechada: json.error?.code === 131047 } // CONFIRMAR AO VIVO
    }
    return { ok: true, wamid: json.messages?.[0]?.id }
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}

/** Marca como lida e mostra "digitando…" pro cliente (some sozinho em ~25s ou quando a resposta chega). */
export async function marcarLidaEDigitando(cred: Credenciais, wamid: string): Promise<void> {
  if (simulando()) return
  await fetch(`${GRAPH}/${GRAPH_VERSAO}/${cred.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cred.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: wamid, typing_indicator: { type: 'text' } }), // CONFIRMAR AO VIVO
  }).catch(() => undefined)
}

/** Baixa uma mídia recebida (áudio/imagem). */
export async function baixarMidia(token: string, midiaId: string): Promise<{ dados: ArrayBuffer; mime: string } | null> {
  if (simulando()) return null
  const info = await fetch(`${GRAPH}/${GRAPH_VERSAO}/${midiaId}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!info.ok) return null
  const { url, mime_type } = (await info.json()) as { url: string; mime_type: string }
  const arq = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!arq.ok) return null
  return { dados: await arq.arrayBuffer(), mime: mime_type }
}

/** Sobe uma mídia pra mandar depois pelo id. */
export async function subirMidia(cred: Credenciais, arquivo: Blob, mime: string): Promise<string | null> {
  if (simulando()) return `midia.SIM${Date.now()}`
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mime)
  form.append('file', arquivo)
  const r = await fetch(`${GRAPH}/${GRAPH_VERSAO}/${cred.phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cred.token}` },
    body: form,
  })
  if (!r.ok) return null
  return ((await r.json()) as { id?: string }).id ?? null
}

/** Confere se phone_number_id + token funcionam (usado na tela de conexão). */
export async function conferirNumero(cred: Credenciais): Promise<{ ok: true; numero: string; nome: string } | { ok: false; erro: string }> {
  if (simulando()) return { ok: true, numero: '+55 11 90000-0000', nome: 'Número simulado' }
  try {
    const r = await fetch(`${GRAPH}/${GRAPH_VERSAO}/${cred.phoneNumberId}?fields=display_phone_number,verified_name`, {
      headers: { Authorization: `Bearer ${cred.token}` },
    })
    const j = (await r.json()) as { display_phone_number?: string; verified_name?: string; error?: { message?: string } }
    if (!r.ok) return { ok: false, erro: j.error?.message ?? `HTTP ${r.status}` }
    return { ok: true, numero: j.display_phone_number ?? '', nome: j.verified_name ?? '' }
  } catch (e) {
    return { ok: false, erro: (e as Error).message }
  }
}
