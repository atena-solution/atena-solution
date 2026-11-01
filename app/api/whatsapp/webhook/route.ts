// Webhook único do WhatsApp (Meta Cloud API). Roteia pela phone_number_id → empresa.
// GET: verificação (hub.challenge). POST: mensagens e status — responde 200 rápido e processa depois (after + fila).

import { after } from 'next/server'
import { simulando } from '@/lib/dados'
import { verificarDesafio } from '@/lib/integracoes/whatsapp'
import { conferirAssinaturaWebhook } from '@/lib/atendimento/webhook'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { processarItem, receberWebhook } from '@/lib/atendimento/processar'
import { ESPERA_RAJADA_MS } from '@/lib/atendimento/rajada'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: Request) {
  const desafio = verificarDesafio(new URL(req.url).searchParams, process.env.WHATSAPP_TOKEN_VERIFICACAO)
  if (desafio === null) return new Response('Proibido', { status: 403 })
  return new Response(desafio, { status: 200, headers: { 'content-type': 'text/plain' } })
}

export async function POST(req: Request) {
  const bruto = await req.text()
  let corpo: unknown
  try {
    corpo = JSON.parse(bruto)
  } catch {
    return new Response('ok', { status: 200 }) // a Meta não deve reenviar lixo
  }
  const deps = await depsAtendimento()
  const assinatura = await conferirAssinaturaWebhook({
    bruto,
    corpo,
    cabecalho: req.headers.get('x-hub-signature-256'),
    repo: deps.repo,
    decifrar: deps.decifrar,
    segredoGlobal: process.env.WHATSAPP_APP_SECRET,
    simulando: simulando(),
  })
  if (!assinatura.ok) {
    console.error('Webhook WhatsApp recusado:', assinatura.motivo)
    return new Response('Assinatura inválida', { status: 401 })
  }
  const r = await receberWebhook(corpo, deps)
  // espera a rajada (~8s) e responde; se a função cair, o cron pega o que ficou na fila
  after(async () => {
    await new Promise((ok) => setTimeout(ok, ESPERA_RAJADA_MS + 300))
    for (const i of r.itens) await processarItem(i.itemId, i.empresaId, deps).catch((e) => console.error('Atendimento:', e))
  })
  return new Response('ok', { status: 200 })
}
