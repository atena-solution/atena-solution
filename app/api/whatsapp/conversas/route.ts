// Lista de conversas da empresa (a tela usa tempo real do Firestore; esta rota serve o modo simulado e o primeiro carregamento).

import { rota } from '@/lib/api/rota'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { contarPorFiltro } from '@/lib/atendimento/caixa'

export const dynamic = 'force-dynamic'

export const GET = rota(undefined, async (_req, { sessao }) => {
  const { repo } = await depsAtendimento()
  const conversas = await repo.listarConversas(sessao.empresaId, 300)
  return Response.json({ conversas, contagem: contarPorFiltro(conversas, sessao.uid), agora: new Date().toISOString() })
})
