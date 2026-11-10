// SÓ NO MODO SIMULADO: finge que um cliente mandou mensagem no WhatsApp da empresa (passa pelo webhook de verdade).

import { after } from 'next/server'
import { rota, corpo } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { simulando } from '@/lib/dados'
import { webhookDeTexto } from '@/lib/integracoes/whatsapp'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { processarItem, receberWebhook } from '@/lib/atendimento/processar'
import { normalizarTelefone } from '@/lib/atendimento/regras'
import { ESPERA_RAJADA_MS } from '@/lib/atendimento/rajada'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const POST = rota(undefined, async (req, { sessao }) => {
  if (!simulando()) throw new ErroHttp(404, 'Disponível só no modo simulado.')
  const p = await corpo<{ telefone?: string; nome?: string; texto?: string }>(req)
  const texto = (p.texto ?? '').trim()
  if (!texto) throw new ErroHttp(400, 'Escreva a mensagem do cliente.')
  const deps = await depsAtendimento()
  const conexao = await deps.repo.conexao(sessao.empresaId)
  if (!conexao) throw new ErroHttp(400, 'Conecte o WhatsApp (simulado) primeiro.')
  const telefone = normalizarTelefone(p.telefone || '11900001111')
  const r = await receberWebhook(webhookDeTexto({ phoneNumberId: conexao.phoneNumberId, de: telefone, nome: p.nome || 'Cliente teste', texto }), deps)
  after(async () => {
    await new Promise((ok) => setTimeout(ok, ESPERA_RAJADA_MS + 300))
    for (const i of r.itens) await processarItem(i.itemId, i.empresaId, deps).catch((e) => console.error(e))
  })
  return Response.json({ ok: true, conversaId: r.itens[0]?.conversaId })
})
