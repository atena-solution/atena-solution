// GET: placar por vendedor, tendência semanal, objeções da semana e biblioteca.
import { autenticar, repositorio, responder } from '@/lib/coach/servidor';
import { obterPlacar } from '@/lib/coach/servico';

export async function GET(req: Request) {
  return responder(async () => {
    const s = await autenticar(req);
    return { ...(await obterPlacar(s, await repositorio())), papel: s.papel, uid: s.uid };
  });
}
