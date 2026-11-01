// POST multipart: audio (Blob), trilha, indice, duracaoSeg, inicioSeg (opcional). Guarda no Storage, transcreve e salva o andamento.
import { armazenamento, autenticar, repositorio, responder } from '@/lib/coach/servidor';
import { ErroCoach, receberPedaco } from '@/lib/coach/servico';
import { transcreverPedaco } from '@/lib/integracoes/gemini';
import type { Trilha } from '@/lib/coach/tipos';

export const maxDuration = 120;
const LIMITE_PEDACO = 15 * 1024 * 1024; // inline no Gemini: request até 20 MB

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const { id } = await params;
    const s = await autenticar(req);
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof Blob)) throw new ErroCoach(400, 'Faltou o áudio.');
    if (audio.size > LIMITE_PEDACO) throw new ErroCoach(413, 'Pedaço grande demais.');
    const bytes = new Uint8Array(await audio.arrayBuffer());
    const arm = await armazenamento();
    const { pedaco, reuniao } = await receberPedaco(
      s, await repositorio(), id,
      {
        trilha: String(form.get('trilha')) as Trilha,
        indice: Number(form.get('indice')),
        duracaoSeg: Number(form.get('duracaoSeg')) || undefined,
        inicioSeg: form.get('inicioSeg') !== null && Number.isFinite(Number(form.get('inicioSeg'))) ? Math.max(0, Number(form.get('inicioSeg'))) : undefined,
        audio: bytes,
        mime: audio.type || 'audio/webm',
      },
      (a, m, p) => transcreverPedaco(a, m, p),
      undefined,
      (c, b, m) => arm.salvar(c, b, m),
    );
    return { pedaco: { ...pedaco, falas: pedaco.falas.length }, duracaoSeg: reuniao.duracaoSeg, pedacos: reuniao.pedacos.length };
  });
}
