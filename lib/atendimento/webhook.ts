// Confere a assinatura do webhook da Meta (X-Hub-Signature-256).
// Cada empresa pode usar um app próprio na Meta (App Secret dela) ou o app da Atena (WHATSAPP_APP_SECRET).

import { lerWebhook, verificarAssinatura } from '@/lib/integracoes/whatsapp'
import type { RepoAtendimento } from './repositorio'

export async function conferirAssinaturaWebhook(p: {
  bruto: string
  corpo: unknown
  cabecalho: string | null
  repo: RepoAtendimento
  decifrar: (x: string) => string
  segredoGlobal?: string
  simulando: boolean
}): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const numeros = [...new Set(lerWebhook(p.corpo).map((e) => e.phoneNumberId))]
  if (!numeros.length) {
    // corpo sem nada nosso: só aceita se a assinatura global bater (ou em teste)
    if (p.segredoGlobal) return verificarAssinatura(p.bruto, p.cabecalho, p.segredoGlobal) ? { ok: true } : { ok: false, motivo: 'assinatura' }
    return p.simulando ? { ok: true } : { ok: false, motivo: 'sem segredo' }
  }
  for (const pnid of numeros) {
    const empresaId = await p.repo.empresaPorPhoneNumberId(pnid)
    const conexao = empresaId ? await p.repo.conexao(empresaId) : null
    let segredo = p.segredoGlobal
    if (conexao?.appSecretCifrado) {
      try {
        segredo = p.decifrar(conexao.appSecretCifrado)
      } catch {
        return { ok: false, motivo: 'segredo ilegível' }
      }
    }
    if (!segredo) {
      if (p.simulando) continue
      return { ok: false, motivo: 'sem segredo' }
    }
    if (!verificarAssinatura(p.bruto, p.cabecalho, segredo)) return { ok: false, motivo: 'assinatura' }
  }
  return { ok: true }
}
