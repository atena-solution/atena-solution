// Conexão do número de WhatsApp da empresa (v1 manual: phone_number_id, WABA id e token).

import { rota, corpo } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { conferirNumero } from '@/lib/integracoes/whatsapp'
import { cifrarToken, depsAtendimento, decifrarToken } from '@/lib/atendimento/servidor'
import { mascarar } from '@/lib/atendimento/cripto'
import { simulando } from '@/lib/dados'
import type { ModelosAprovados } from '@/lib/atendimento/tipos'

export const dynamic = 'force-dynamic'

export const GET = rota(undefined, async (req, { sessao }) => {
  const { repo } = await depsAtendimento()
  const c = await repo.conexao(sessao.empresaId)
  const urlWebhook = new URL('/api/whatsapp/webhook', req.url).toString()
  if (!c) return Response.json({ conectado: false, urlWebhook, simulado: simulando() })
  let token = ''
  try {
    token = mascarar(decifrarToken(c.tokenCifrado))
  } catch {
    token = '(não foi possível ler — conecte de novo)'
  }
  const { tokenCifrado: _t, ...pub } = c
  void _t
  return Response.json({ conectado: true, conexao: { ...pub, token }, urlWebhook, simulado: simulando() })
})

interface Pedido {
  phoneNumberId?: string
  wabaId?: string
  token?: string
  modelos?: ModelosAprovados
}

export const POST = rota(['dono', 'gestor'], async (req, { sessao }) => {
  const p = await corpo<Pedido>(req)
  const { repo } = await depsAtendimento()
  const atual = await repo.conexao(sessao.empresaId)
  const phoneNumberId = (p.phoneNumberId ?? atual?.phoneNumberId ?? '').trim()
  const wabaId = (p.wabaId ?? atual?.wabaId ?? '').trim()
  const modelos = { ...atual?.modelos, ...limparModelos(p.modelos) }
  if (!/^\d{6,30}$/.test(phoneNumberId) && !(simulando() && phoneNumberId)) throw new ErroHttp(400, 'O ID do número tem só números (veja no passo 3).')
  if (!wabaId) throw new ErroHttp(400, 'Informe o ID da conta do WhatsApp Business (WABA).')
  const token = p.token?.trim()
  if (!token && !atual) throw new ErroHttp(400, 'Cole o token de acesso.')
  const tokenCifrado = token ? cifrarToken(token) : atual!.tokenCifrado
  const conferido = await conferirNumero({ phoneNumberId, token: token ?? decifrarToken(atual!.tokenCifrado) })
  if (!conferido.ok) throw new ErroHttp(400, `A Meta não aceitou: ${conferido.erro}`)
  try {
    await repo.salvarConexao({
      empresaId: sessao.empresaId,
      phoneNumberId,
      wabaId,
      tokenCifrado,
      numeroExibicao: conferido.numero,
      nomeVerificado: conferido.nome,
      conectadoEm: atual?.conectadoEm ?? new Date().toISOString(),
      modelos,
    })
  } catch (e) {
    throw new ErroHttp(400, (e as Error).message)
  }
  return Response.json({ ok: true, numero: conferido.numero, nome: conferido.nome })
})

export const DELETE = rota(['dono', 'gestor'], async (_req, { sessao }) => {
  const { repo } = await depsAtendimento()
  await repo.removerConexao(sessao.empresaId)
  return Response.json({ ok: true })
})

function limparModelos(m?: ModelosAprovados): ModelosAprovados {
  if (!m) return {}
  const ok = (v?: string) => (v ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 512) || undefined
  return { lembrete: ok(m.lembrete), recuperacao: ok(m.recuperacao), avaliacao: ok(m.avaliacao), retomada: ok(m.retomada), idioma: (m.idioma ?? 'pt_BR').slice(0, 10) }
}
