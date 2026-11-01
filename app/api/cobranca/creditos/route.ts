import { rota, corpo } from '@/lib/api/rota';
import { depsCobranca } from '@/lib/cobranca';
import { comprarCreditos, type DadosPagador } from '@/lib/cobranca/servico';
import { comErros } from '../_util';

/** Compra um pacote de créditos do Estúdio. Os créditos entram quando o pagamento for confirmado. */
export const POST = rota(['dono', 'gestor'], async (req, { sessao }) =>
  comErros(async () => {
    const e = await corpo<{ pacoteId?: string; pagador?: DadosPagador }>(req);
    const pagador = e.pagador ? { nome: String(e.pagador.nome ?? ''), cpfCnpj: String(e.pagador.cpfCnpj ?? ''), email: sessao.email } : undefined;
    const r = await comprarCreditos(await depsCobranca(), sessao.empresaId, String(e.pacoteId ?? ''), pagador);
    return Response.json({ faturaUrl: r.faturaUrl });
  }),
);
