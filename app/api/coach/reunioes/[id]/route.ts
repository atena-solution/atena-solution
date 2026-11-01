// GET: reunião completa (falas juntadas + URLs do áudio pro player). PATCH: biblioteca (dono/gestor).
import { armazenamento, autenticar, repositorio, responder } from '@/lib/coach/servidor';
import { marcarBiblioteca, obterReuniao } from '@/lib/coach/servico';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  return responder(async () => {
    const { id } = await params;
    const s = await autenticar(req);
    const { reuniao, falas } = await obterReuniao(s, await repositorio(), id);
    const arm = await armazenamento();
    const audios = await Promise.all(
      reuniao.pedacos
        .filter((p) => p.caminhoAudio)
        .map(async (p) => ({ trilha: p.trilha, indice: p.indice, inicioSeg: p.inicioSeg, duracaoSeg: p.duracaoSeg, url: await arm.urlLeitura(p.caminhoAudio!) })),
    );
    if (reuniao.arquivo) audios.push({ trilha: 'misto', indice: 0, inicioSeg: 0, duracaoSeg: reuniao.duracaoSeg, url: await arm.urlLeitura(reuniao.arquivo.caminho) });
    const podeGerir = s.papel === 'dono' || s.papel === 'gestor';
    const { pedacos, ...resto } = reuniao;
    return {
      reuniao: { ...resto, pedacos: pedacos.map(({ falas: _f, ...p }) => p) },
      falas, audios, podeGerir, podeEditar: podeGerir || reuniao.vendedorUid === s.uid,
    };
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  return responder(async () => {
    const { id } = await params;
    const s = await autenticar(req);
    const corpo = (await req.json()) as { naBiblioteca?: boolean };
    const r = await marcarBiblioteca(s, await repositorio(), id, !!corpo.naBiblioteca);
    return { naBiblioteca: r.naBiblioteca };
  });
}
