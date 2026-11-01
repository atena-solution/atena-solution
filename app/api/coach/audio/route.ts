// Só no modo simulado: guarda e serve áudio da memória do servidor (no real, URLs assinadas do Storage).
// Isolamento: o caminho precisa ser da empresa de quem pede.
import { armazenamento, autenticar, responder, simulandoServidor } from '@/lib/coach/servidor';
import { caminhoDaEmpresa } from '@/lib/coach/armazenamento';
import { ErroCoach } from '@/lib/coach/servico';

async function caminho(req: Request) {
  if (!simulandoServidor()) throw new ErroCoach(404, 'Não encontrado.');
  const s = await autenticar(req);
  const c = new URL(req.url).searchParams.get('c') ?? '';
  if (!caminhoDaEmpresa(c, s.empresaId)) throw new ErroCoach(404, 'Não encontrado.');
  return c;
}

export async function GET(req: Request) {
  return responder(async () => {
    const c = await caminho(req);
    const arm = (await armazenamento()) as Awaited<ReturnType<typeof armazenamento>> & { _dados?: Map<string, { bytes: Uint8Array; mime: string }> };
    const x = arm._dados?.get(c);
    if (!x) throw new ErroCoach(404, 'Áudio não encontrado.');
    return new Response(x.bytes as unknown as BodyInit, { headers: { 'Content-Type': x.mime, 'Cache-Control': 'private, max-age=3600' } });
  });
}

export async function PUT(req: Request) {
  return responder(async () => {
    const c = await caminho(req);
    const bytes = new Uint8Array(await req.arrayBuffer());
    await (await armazenamento()).salvar(c, bytes, req.headers.get('content-type') || 'application/octet-stream');
    return { ok: true };
  });
}
