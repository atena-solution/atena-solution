// Treinar a IA: perguntas e respostas, tom, o que nunca dizer, quando chamar humano, automações.

import { rota, corpo } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { validarTreino } from '@/lib/atendimento/treino'
import type { Treino } from '@/lib/atendimento/tipos'

export const dynamic = 'force-dynamic'

export const GET = rota(undefined, async (_req, { sessao }) => {
  const { repo } = await depsAtendimento()
  const [treino, conexao, servicos] = await Promise.all([repo.treino(sessao.empresaId), repo.conexao(sessao.empresaId), repo.servicos(sessao.empresaId)])
  return Response.json({ treino, conectado: !!conexao, servicos: servicos.length })
})

export const PUT = rota(['dono', 'gestor'], async (req, { sessao }) => {
  const p = await corpo<Partial<Treino>>(req)
  const { repo } = await depsAtendimento()
  const atual = await repo.treino(sessao.empresaId)
  const r = validarTreino({ ...atual, ...p, empresaId: sessao.empresaId })
  if (!r.ok) return Response.json({ erro: 'Confira os campos.', erros: r.erros }, { status: 400 })
  if (r.treino.ligada && !(await repo.conexao(sessao.empresaId))) throw new ErroHttp(400, 'Conecte o WhatsApp antes de ligar a IA.')
  await repo.salvarTreino({ ...r.treino, atualizadoEm: new Date().toISOString() })
  return Response.json({ ok: true, treino: r.treino })
})
