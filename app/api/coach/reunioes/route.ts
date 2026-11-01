// GET: lista (?contatoId=). POST: cria reunião (gravação ou arquivo; no arquivo devolve a URL de envio direto).
import { armazenamento, autenticar, novoId, repositorio, responder } from '@/lib/coach/servidor';
import { criarReuniao, listarReunioes, type NovaReuniao } from '@/lib/coach/servico';

export async function GET(req: Request) {
  return responder(async () => {
    const s = await autenticar(req);
    const sp = new URL(req.url).searchParams;
    const lista = await listarReunioes(s, await repositorio(), { contatoId: sp.get('contatoId') ?? undefined, vendedorUid: sp.get('vendedorUid') ?? undefined });
    // lista leve: sem falas
    return { reunioes: lista.map(({ pedacos, ...r }) => ({ ...r, pedacos: pedacos.length })) };
  });
}

export async function POST(req: Request) {
  return responder(async () => {
    const s = await autenticar(req);
    const corpo = (await req.json()) as NovaReuniao;
    const reuniao = await criarReuniao(s, await repositorio(), corpo, novoId());
    const envio = reuniao.arquivo ? await (await armazenamento()).urlEnvio(reuniao.arquivo.caminho, reuniao.arquivo.mime) : null;
    return { reuniao, envio };
  });
}
