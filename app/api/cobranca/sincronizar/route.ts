import { rota } from '@/lib/api/rota';
import { depsCobranca } from '@/lib/cobranca';
import { lerAcesso, sincronizar, sincronizarPP } from '@/lib/cobranca/servico';

/** Botão "Já paguei": relê as cobranças no Asaas (ou as vendas na Perfect Pay) e libera se estiverem pagas. */
export const POST = rota(['dono', 'gestor'], async (_req, { sessao }) => {
  const d = await depsCobranca();
  const resultados = d.pp ? await sincronizarPP(d, sessao.empresaId, sessao.email) : await sincronizar(d, sessao.empresaId);
  return Response.json({ liberou: resultados.some((r) => r.resultado === 'aplicado'), situacao: await lerAcesso(d, sessao.empresaId) });
});
