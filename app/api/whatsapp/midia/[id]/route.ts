// Mostra na caixa de entrada a foto/áudio que o cliente mandou (baixa da Meta com o token da empresa).

import { rota } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { baixarMidia } from '@/lib/integracoes/whatsapp'

export const dynamic = 'force-dynamic'

export const GET = rota<{ id: string }>(undefined, async (_req, { sessao, params }) => {
  const deps = await depsAtendimento()
  const conexao = await deps.repo.conexao(sessao.empresaId)
  if (!conexao) throw new ErroHttp(404, 'Sem WhatsApp conectado.')
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(params.id)) throw new ErroHttp(400, 'Mídia inválida.')
  const m = await baixarMidia(deps.decifrar(conexao.tokenCifrado), params.id)
  if (!m) throw new ErroHttp(404, 'Mídia não disponível (no modo simulado não há arquivos).')
  return new Response(m.dados, { headers: { 'content-type': m.mime, 'cache-control': 'private, max-age=3600' } })
})
