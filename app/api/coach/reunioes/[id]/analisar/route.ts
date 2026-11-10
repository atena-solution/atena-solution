// POST: junta as trilhas, analisa com o Claude contra o roteiro e liga com Contatos.
import { autenticar, dadosEmpresa, exigirCoach, ganchosContatos, repositorio, responder, usoDaEmpresa } from '@/lib/coach/servidor';
import { analisarReuniao } from '@/lib/coach/servico';
import { analisarComIA } from '@/lib/coach/ia';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const { id } = await params;
    const s = await autenticar(req);
    await exigirCoach(s.empresaId);
    const emp = await dadosEmpresa(s.empresaId);
    const { reuniao, etapaNova } = await analisarReuniao(s, await repositorio(), id, {
      segmentoEmpresa: emp.segmento,
      analisar: (e) => analisarComIA({ ...e, empresaNome: emp.nome, aoUsar: usoDaEmpresa(s.empresaId) }),
      contatos: await ganchosContatos(),
    });
    return { status: reuniao.status, analise: reuniao.analise, erro: reuniao.erro, etapaNova };
  });
}
