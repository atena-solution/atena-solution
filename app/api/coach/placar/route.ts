// GET: placar (ou ?resumo=1 pro cartão do Início): por vendedor, tendência semanal, objeções da semana e biblioteca.
import { autenticar, repositorio, responder } from '@/lib/coach/servidor';
import { listarReunioes, obterPlacar } from '@/lib/coach/servico';
import { resumoInicio } from '@/lib/coach/placar';

export async function GET(req: Request) {
  return responder(async () => {
    const s = await autenticar(req);
    // ?resumo=1 → cartão do Início (reuniões de hoje, nota e fechamentos da semana)
    if (new URL(req.url).searchParams.get('resumo')) return resumoInicio(await listarReunioes(s, await repositorio()));
    return { ...(await obterPlacar(s, await repositorio())), papel: s.papel, uid: s.uid };
  });
}
