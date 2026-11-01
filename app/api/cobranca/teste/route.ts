import { rota, corpo } from '@/lib/api/rota';
import { depsCobranca } from '@/lib/cobranca';
import { iniciarTeste } from '@/lib/cobranca/servico';
import { obterPlano } from '@/lib/planos/preco';

/** Começa o teste grátis (chamado logo depois de criar a empresa). Idempotente. */
export const POST = rota(['dono'], async (req, { sessao }) => {
  const e = await corpo<{ planoId?: string }>(req).catch(() => ({}) as { planoId?: string });
  const plano = e.planoId ? obterPlano(e.planoId) : undefined;
  const a = await iniciarTeste(await depsCobranca(), sessao.empresaId, plano?.id);
  return Response.json({ testeAte: a.testeAte, planoId: a.planoId });
});
