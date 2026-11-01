// Cron da Vercel (a cada 5 min): fila que sobrou, lembretes da agenda e avisos pra equipe.
// vercel.json: { "crons": [{ "path": "/api/whatsapp/cron", "schedule": "*/5 * * * *" }] }
// A Vercel manda Authorization: Bearer $CRON_SECRET (doc consultada em 01/11/2026, vercel.com/docs/cron-jobs). CONFIRMAR AO VIVO

import { depsAtendimento, cronAutorizado } from '@/lib/atendimento/servidor'
import { processarFila, rodarAutomacoes, rodarAvisos } from '@/lib/atendimento/processar'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  if (!cronAutorizado(req)) return new Response('Proibido', { status: 401 })
  const deps = await depsAtendimento()
  const fila = await processarFila(deps)
  const resumo: Record<string, unknown> = {}
  for (const empresaId of await deps.repo.empresasConectadas()) {
    try {
      const auto = await rodarAutomacoes(empresaId, deps)
      const avisos = await rodarAvisos(empresaId, deps)
      resumo[empresaId] = { lembretes: auto.enviadas, pulados: auto.puladas.length, avisos }
    } catch (e) {
      console.error('cron atendimento', empresaId, e)
      resumo[empresaId] = { erro: (e as Error).message }
    }
  }
  return Response.json({ ok: true, fila, empresas: resumo })
}
