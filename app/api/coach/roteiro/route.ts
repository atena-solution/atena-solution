// GET: roteiro da empresa (ou modelo do segmento). PUT: salva (dono/gestor).
import { autenticar, dadosEmpresa, repositorio, responder } from '@/lib/coach/servidor';
import { obterRoteiro, salvarRoteiro } from '@/lib/coach/servico';
import { modeloDeRoteiro, SEGMENTOS } from '@/lib/coach/modelos';

export async function GET(req: Request) {
  return responder(async () => {
    const s = await autenticar(req);
    const modelo = new URL(req.url).searchParams.get('modelo');
    if (modelo) return { roteiro: modeloDeRoteiro(modelo), ehModelo: true, segmentos: SEGMENTOS };
    const emp = await dadosEmpresa(s.empresaId);
    return { ...(await obterRoteiro(s, await repositorio(), emp.segmento)), segmentos: SEGMENTOS };
  });
}

export async function PUT(req: Request) {
  return responder(async () => {
    const s = await autenticar(req);
    return { roteiro: await salvarRoteiro(s, await repositorio(), await req.json()) };
  });
}
