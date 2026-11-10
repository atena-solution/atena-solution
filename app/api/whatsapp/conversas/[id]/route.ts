// Uma conversa: mensagens, ficha do contato e ações da equipe (assumir, devolver, resolver, enviar).

import { rota, corpo } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { acaoNaConversa, enviarDaEquipe, type AcaoConversa } from '@/lib/atendimento/processar'
import { janela24h } from '@/lib/atendimento/janela'

export const dynamic = 'force-dynamic'

const PODE_ATENDER = ['dono', 'gestor', 'atendente'] as const

export const GET = rota<{ id: string }>(undefined, async (_req, { sessao, params }) => {
  const deps = await depsAtendimento()
  const conversa = await deps.repo.conversa(sessao.empresaId, params.id)
  if (!conversa) throw new ErroHttp(404, 'Conversa não encontrada.')
  const [mensagens, contato, agendamentos, atividades, conexao, servicos, profissionais] = await Promise.all([
    deps.repo.mensagens(sessao.empresaId, conversa.id, 200),
    deps.repo.contato(sessao.empresaId, conversa.contatoId),
    deps.repo.agendamentosDoContato(sessao.empresaId, conversa.contatoId),
    deps.repo.atividades(sessao.empresaId, conversa.contatoId, 20),
    deps.repo.conexao(sessao.empresaId),
    deps.repo.servicos(sessao.empresaId),
    deps.repo.profissionais(sessao.empresaId),
  ])
  return Response.json({
    conversa,
    mensagens,
    contato,
    agendamentos: agendamentos.sort((a, b) => b.inicio.localeCompare(a.inicio)).slice(0, 10),
    atividades: atividades.reverse(),
    janela: janela24h(conversa.ultimaMsgClienteEm, new Date()),
    temModeloRetomada: !!conexao?.modelos.retomada,
    servicos: servicos.map((s) => ({ id: s.id, nome: s.nome })),
    profissionais: profissionais.map((p) => ({ id: p.id, nome: p.nome })),
  })
})

interface Pedido {
  acao?: AcaoConversa
  texto?: string
}

export const POST = rota<{ id: string }>([...PODE_ATENDER], async (req, { sessao, params }) => {
  const p = await corpo<Pedido>(req)
  const deps = await depsAtendimento()
  if (p.texto !== undefined) {
    if (p.texto.length > 4096) throw new ErroHttp(400, 'Mensagem longa demais (máx. 4096 letras).')
    const r = await enviarDaEquipe(sessao.empresaId, params.id, sessao.uid, { texto: p.texto }, deps)
    if (!r.ok) throw new ErroHttp(400, r.erro)
    return Response.json({ ok: true, mensagem: r.mensagem })
  }
  if (!p.acao || !['assumir', 'devolver', 'resolver', 'reabrir', 'lida'].includes(p.acao)) throw new ErroHttp(400, 'Ação inválida.')
  const ok = await acaoNaConversa(sessao.empresaId, params.id, sessao.uid, p.acao, deps)
  if (!ok) throw new ErroHttp(404, 'Conversa não encontrada.')
  return Response.json({ ok: true })
})
