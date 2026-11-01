// Números do Atendimento pro cartão do Início.

import { rota } from '@/lib/api/rota'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { calcularMetricas } from '@/lib/atendimento/metricas'
import { diaLocal, instanteLocal, somarDias } from '@/lib/atendimento/tempo'

export const dynamic = 'force-dynamic'

export const GET = rota(undefined, async (_req, { sessao }) => {
  const { repo } = await depsAtendimento()
  const empresa = await repo.empresa(sessao.empresaId)
  const fuso = empresa?.fuso ?? 'America/Sao_Paulo'
  const hoje = diaLocal(new Date(), fuso)
  const deISO = instanteLocal(hoje, '00:00', fuso).toISOString()
  const ateISO = instanteLocal(somarDias(hoje, 1), '00:00', fuso).toISOString()
  const [conversas, agendamentos] = await Promise.all([
    repo.listarConversas(sessao.empresaId, 1000),
    repo.agendamentos(sessao.empresaId, new Date(Date.parse(deISO) - 60 * 86400000).toISOString(), new Date(Date.parse(ateISO) + 120 * 86400000).toISOString()),
  ])
  return Response.json(calcularMetricas({ conversas, agendamentos, deISO, ateISO }))
})
