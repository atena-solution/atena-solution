// Inscrição de web push do aparelho da pessoa da equipe.

import { rota, corpo } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { depsAtendimento } from '@/lib/atendimento/servidor'

export const dynamic = 'force-dynamic'

export const GET = rota(undefined, async () => Response.json({ chavePublica: process.env.NEXT_PUBLIC_VAPID_PUBLICA ?? null }))

export const POST = rota(undefined, async (req, { sessao }) => {
  const p = await corpo<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>(req)
  if (!p.endpoint?.startsWith('https://') || !p.keys?.p256dh || !p.keys?.auth) throw new ErroHttp(400, 'Inscrição inválida.')
  const { repo } = await depsAtendimento()
  await repo.salvarInscricaoPush(sessao.empresaId, { uid: sessao.uid, endpoint: p.endpoint, chaves: { p256dh: p.keys.p256dh, auth: p.keys.auth } })
  return Response.json({ ok: true })
})
