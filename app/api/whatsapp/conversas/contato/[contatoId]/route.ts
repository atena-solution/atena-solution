// Conversa do WhatsApp de um contato (para a ficha do contato). Sem conversa → { conversa: null } (não é erro).
import { rota } from '@/lib/api/rota'
import { depsAtendimento } from '@/lib/atendimento/servidor'

export const dynamic = 'force-dynamic'

export const GET = rota<{ contatoId: string }>(undefined, async (_req, { sessao, params }) => {
  const deps = await depsAtendimento()
  const conversa = await deps.repo.conversaDoContato(sessao.empresaId, params.contatoId)
  if (!conversa) return Response.json({ conversa: null, mensagens: [] })
  const mensagens = await deps.repo.mensagens(sessao.empresaId, conversa.id, 6)
  return Response.json({ conversa, mensagens })
})
