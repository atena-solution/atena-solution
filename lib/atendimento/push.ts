// Web push para avisar a equipe (cliente esperando humano).
// Doc (consultada em 01/11/2026, github.com/web-push-libs/web-push): setVapidDetails(assunto, chavePublica, chavePrivada)
// e sendNotification(inscricao, corpo). Gerar chaves: npx web-push generate-vapid-keys.
// Env: NEXT_PUBLIC_VAPID_PUBLICA, VAPID_PRIVADA, VAPID_ASSUNTO (mailto:...). CONFIRMAR AO VIVO.

import 'server-only'
import type { RepoAtendimento } from './repositorio'

export function pushConfigurado(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLICA && process.env.VAPID_PRIVADA)
}

export function criarEnviarPush(repo: RepoAtendimento) {
  return async (p: { empresaId: string; uids: string[]; titulo: string; corpo: string; url: string }) => {
    if (process.env.SIMULAR === '1' || !pushConfigurado()) {
      console.info(`[push simulado] ${p.titulo} — ${p.corpo} → ${p.uids.join(', ')}`)
      return
    }
    const webpush = (await import('web-push')).default
    webpush.setVapidDetails(process.env.VAPID_ASSUNTO || 'mailto:contato@atena.solution', process.env.NEXT_PUBLIC_VAPID_PUBLICA!, process.env.VAPID_PRIVADA!)
    const inscricoes = await repo.inscricoesPush(p.empresaId, p.uids)
    await Promise.all(
      inscricoes.map((i) =>
        webpush
          .sendNotification({ endpoint: i.endpoint, keys: i.chaves }, JSON.stringify({ titulo: p.titulo, corpo: p.corpo, url: p.url }))
          .catch(() => undefined),
      ),
    )
  }
}
