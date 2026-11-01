// Envio de foto/áudio pela equipe: sobe na Meta e manda pelo id da mídia.

import { rota } from '@/lib/api/rota'
import { ErroHttp } from '@/lib/auth/erros'
import { depsAtendimento } from '@/lib/atendimento/servidor'
import { enviarDaEquipe } from '@/lib/atendimento/processar'
import { subirMidia } from '@/lib/integracoes/whatsapp'
import { simulando } from '@/lib/dados'

export const dynamic = 'force-dynamic'

// Limites da Meta (doc consultada em 01/11/2026): imagem 5 MB (jpeg/png), áudio 16 MB (aac/mp4/mpeg/amr/ogg opus). CONFIRMAR AO VIVO
const TIPOS: Record<string, { tipo: 'imagem' | 'audio'; max: number }> = {
  'image/jpeg': { tipo: 'imagem', max: 5 * 1024 * 1024 },
  'image/png': { tipo: 'imagem', max: 5 * 1024 * 1024 },
  'audio/ogg': { tipo: 'audio', max: 16 * 1024 * 1024 },
  'audio/mpeg': { tipo: 'audio', max: 16 * 1024 * 1024 },
  'audio/mp4': { tipo: 'audio', max: 16 * 1024 * 1024 },
  'audio/aac': { tipo: 'audio', max: 16 * 1024 * 1024 },
  'audio/amr': { tipo: 'audio', max: 16 * 1024 * 1024 },
}

export const POST = rota<{ id: string }>(['dono', 'gestor', 'atendente'], async (req, { sessao, params }) => {
  const form = await req.formData().catch(() => null)
  const arquivo = form?.get('arquivo')
  if (!(arquivo instanceof Blob)) throw new ErroHttp(400, 'Escolha um arquivo.')
  const mime = (arquivo.type || '').split(';')[0]
  const regra = TIPOS[mime]
  if (!regra) throw new ErroHttp(400, 'Formato não aceito pelo WhatsApp. Use foto JPG/PNG ou áudio OGG/MP3/M4A.')
  if (arquivo.size > regra.max) throw new ErroHttp(400, `Arquivo grande demais (máx. ${regra.max / 1024 / 1024} MB).`)
  const deps = await depsAtendimento()
  const conexao = await deps.repo.conexao(sessao.empresaId)
  if (!conexao) throw new ErroHttp(400, 'Conecte o WhatsApp primeiro.')
  const midiaId = await subirMidia({ phoneNumberId: conexao.phoneNumberId, token: deps.decifrar(conexao.tokenCifrado) }, arquivo, mime)
  if (!midiaId && !simulando()) throw new ErroHttp(502, 'A Meta não aceitou o arquivo. Tente de novo.')
  const legenda = String(form?.get('legenda') ?? '').slice(0, 1024)
  const r = await enviarDaEquipe(sessao.empresaId, params.id, sessao.uid, { midia: regra.tipo, midiaId: midiaId ?? 'simulado', legenda }, deps)
  if (!r.ok) throw new ErroHttp(400, r.erro)
  return Response.json({ ok: true, mensagem: r.mensagem })
})
