// Simulador: conversar com a IA usando os dados reais da empresa, sem WhatsApp e sem gravar nada.

import { rota, corpo } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { simularConversa, type FalaSimulador } from '@/lib/atendimento/simulador'
import type { Treino } from '@/lib/atendimento/tipos'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = rota(['dono', 'gestor', 'atendente'], async (req, { sessao }) => {
  const p = await corpo<{ falas?: FalaSimulador[]; treino?: Partial<Treino> }>(req)
  const falas = (p.falas ?? []).slice(-30)
  if (!falas.length || falas.at(-1)!.de !== 'cliente') throw new ErroHttp(400, 'Escreva uma mensagem como se fosse o cliente.')
  if (falas.some((f) => typeof f.texto !== 'string' || f.texto.length > 2000)) throw new ErroHttp(400, 'Mensagem inválida.')
  const deps = await depsAtendimento()
  const r = await simularConversa({ empresaId: sessao.empresaId, falas, rascunho: p.treino, deps })
  return Response.json(r)
})
