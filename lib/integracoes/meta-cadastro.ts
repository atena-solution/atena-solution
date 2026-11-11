// Cadastro Incorporado da Meta (Embedded Signup v4) — o cliente aperta "Conectar", entra com o Facebook dele
// e o número já vem pronto, inclusive o que ele usa hoje no app WhatsApp Business (coexistência).
//
// Doc oficial lida em 10/11/2026 (developers.facebook.com → business-messaging/whatsapp/embedded-signup):
// - Front: FB.login(cb, { config_id, response_type: 'code', override_default_response_type: true,
//   extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' } }) —
//   featureType só pra coexistência. Evento window 'message' (origem *.facebook.com) com type 'WA_EMBEDDED_SIGNUP':
//   event FINISH (número novo) | FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING (app) | CANCEL | ERROR; data { phone_number_id?, waba_id }.
//   response.authResponse.code vale 30 s.
// - Servidor: GET /oauth/access_token?client_id&client_secret&code → { access_token } (token da empresa);
//   POST /{waba_id}/subscribed_apps; número novo: POST /{phone_number_id}/register { messaging_product, pin (6 dígitos) }
//   — coexistência PULA o register; GET /{phone_number_id}?fields=is_on_biz_app,platform_type;
//   sincronizar (coexistência, 1 vez, até 24 h): POST /{phone_number_id}/smb_app_data { messaging_product, sync_type: 'smb_app_state_sync' | 'history' }.
// - Limite sem verificação + análise + verificação de acesso: 10 empresas novas a cada 7 dias (depois 200).
// CONFIRMAR AO VIVO no 1º cliente.

import { randomInt } from 'node:crypto'
import { GRAPH_VERSAO, simulando } from './whatsapp'

const GRAPH = 'https://graph.facebook.com'

export interface ConfigCadastro {
  disponivel: boolean
  appId?: string
  configId?: string
  versao: string
}

export function configCadastro(): ConfigCadastro {
  const appId = process.env.META_APP_ID
  const configId = process.env.META_ES_CONFIG_ID
  return { disponivel: !!(appId && configId && process.env.WHATSAPP_APP_SECRET), appId, configId, versao: GRAPH_VERSAO }
}

type Fetch = typeof fetch

async function graph(f: Fetch, metodo: 'GET' | 'POST', caminho: string, token?: string, corpo?: unknown) {
  const r = await f(`${GRAPH}/${GRAPH_VERSAO}/${caminho}`, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  })
  const j = (await r.json().catch(() => ({}))) as any
  if (!r.ok || j?.error) throw new Error(j?.error?.error_user_msg || j?.error?.message || `HTTP ${r.status}`)
  return j
}

export interface PedidoCadastro {
  code: string
  modo: 'app' | 'novo'
  wabaId?: string
  phoneNumberId?: string
}

export interface ResultadoCadastro {
  token: string
  wabaId: string
  phoneNumberId: string
  numero: string
  nome: string
  coexistencia: boolean
  pin?: string
  passos: { etapa: string; ok: boolean; msg: string }[]
}

/** Faz o cadastro inteiro no servidor. Lança erro com mensagem em português quando uma etapa obrigatória falha. */
export async function concluirCadastro(p: PedidoCadastro, f: Fetch = fetch): Promise<ResultadoCadastro> {
  const passos: ResultadoCadastro['passos'] = []
  if (simulando()) {
    return { token: 'TOKEN-SIMULADO', wabaId: p.wabaId || 'WABA-SIM', phoneNumberId: p.phoneNumberId || 'PN-SIM', numero: '+55 11 90000-0000', nome: 'Empresa (simulado)', coexistencia: p.modo === 'app', passos: [{ etapa: 'simulado', ok: true, msg: 'modo de teste' }] }
  }
  const cfg = configCadastro()
  if (!cfg.disponivel) throw new Error('Conexão automática ainda não liberada (faltam META_APP_ID, META_ES_CONFIG_ID ou WHATSAPP_APP_SECRET).')
  if (!p.code) throw new Error('A Meta não devolveu o código. Tente de novo.')

  // 1) código → token da empresa (só no servidor)
  const q = new URLSearchParams({ client_id: cfg.appId!, client_secret: process.env.WHATSAPP_APP_SECRET!, code: p.code })
  const r = await f(`${GRAPH}/${GRAPH_VERSAO}/oauth/access_token?${q}`)
  const j = (await r.json().catch(() => ({}))) as any
  if (!r.ok || !j?.access_token) throw new Error(`A Meta não liberou o acesso: ${j?.error?.message || `HTTP ${r.status}`}. Comece de novo (o código vale 30 segundos).`)
  const token: string = j.access_token
  passos.push({ etapa: 'token', ok: true, msg: 'acesso liberado' })

  const wabaId = (p.wabaId ?? '').trim()
  if (!wabaId) throw new Error('A Meta não informou a conta do WhatsApp. Comece de novo.')

  // 2) número (na coexistência o evento pode vir só com a conta → lista os números dela)
  let phoneNumberId = (p.phoneNumberId ?? '').trim()
  if (!phoneNumberId) {
    const lista = await graph(f, 'GET', `${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, token)
    phoneNumberId = lista?.data?.[0]?.id ?? ''
    if (!phoneNumberId) throw new Error('Nenhum número encontrado na conta do WhatsApp escolhida.')
  }

  // 3) webhooks da conta → Atena
  await graph(f, 'POST', `${wabaId}/subscribed_apps`, token)
  passos.push({ etapa: 'webhook', ok: true, msg: 'mensagens chegando na Atena' })

  // 4) número novo: registrar na API com um PIN de 2 etapas. Coexistência: NÃO registra (a doc manda pular).
  let pin: string | undefined
  if (p.modo === 'novo') {
    pin = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await graph(f, 'POST', `${phoneNumberId}/register`, token, { messaging_product: 'whatsapp', pin })
    passos.push({ etapa: 'registro', ok: true, msg: 'número registrado' })
  }

  // 5) dados do número
  const info = await graph(f, 'GET', `${phoneNumberId}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`, token)
  const coexistencia = info?.is_on_biz_app === true || p.modo === 'app'

  // 6) coexistência: puxar contatos e histórico (uma vez só; se falhar, não trava a conexão)
  if (coexistencia) {
    for (const tipo of ['smb_app_state_sync', 'history'] as const) {
      try {
        const s = await graph(f, 'POST', `${phoneNumberId}/smb_app_data`, token, { messaging_product: 'whatsapp', sync_type: tipo })
        passos.push({ etapa: tipo, ok: true, msg: `pedido ${s?.request_id ?? ''}`.trim() })
      } catch (e) {
        passos.push({ etapa: tipo, ok: false, msg: (e as Error).message })
      }
    }
  }
  return { token, wabaId, phoneNumberId, numero: info?.display_phone_number ?? '', nome: info?.verified_name ?? '', coexistencia, pin, passos }
}
