// Conexão pelo botão da Meta (Cadastro Incorporado). GET = dados públicos pro botão; POST = conclui no servidor.

import { rota, corpo } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { concluirCadastro, configCadastro, type PedidoCadastro } from '@/lib/integracoes/meta-cadastro'
import { cifrarToken, depsAtendimento } from '@/lib/atendimento/servidor'

export const dynamic = 'force-dynamic'

export const GET = rota(undefined, async () => {
  const c = configCadastro()
  return Response.json({ disponivel: c.disponivel, appId: c.appId ?? null, configId: c.configId ?? null, versao: c.versao })
})

export const POST = rota(['dono', 'gestor'], async (req, { sessao }) => {
  const p = await corpo<PedidoCadastro>(req)
  if (p.modo !== 'app' && p.modo !== 'novo') throw new ErroHttp(400, 'Escolha como conectar.')
  let r
  try {
    r = await concluirCadastro({ code: String(p.code ?? ''), modo: p.modo, wabaId: p.wabaId, phoneNumberId: p.phoneNumberId })
  } catch (e) {
    throw new ErroHttp(400, (e as Error).message)
  }
  const { repo } = await depsAtendimento()
  const atual = await repo.conexao(sessao.empresaId)
  try {
    await repo.salvarConexao({
      empresaId: sessao.empresaId,
      phoneNumberId: r.phoneNumberId,
      wabaId: r.wabaId,
      tokenCifrado: cifrarToken(r.token),
      ...(r.pin ? { pinCifrado: cifrarToken(r.pin) } : {}),
      numeroExibicao: r.numero,
      nomeVerificado: r.nome,
      conectadoEm: new Date().toISOString(),
      modelos: atual?.modelos ?? {},
      origem: 'meta',
      coexistencia: r.coexistencia,
    })
  } catch (e) {
    throw new ErroHttp(400, (e as Error).message)
  }
  return Response.json({ ok: true, numero: r.numero, nome: r.nome, coexistencia: r.coexistencia, passos: r.passos })
})
