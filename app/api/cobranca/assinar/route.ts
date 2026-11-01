import { rota, corpo } from '@/lib/api/rota';
import { depsCobranca } from '@/lib/cobranca';
import { assinar, type DadosPagador } from '@/lib/cobranca/servico';
import { obterPlano } from '@/lib/planos/preco';
import type { FormaPagamento } from '@/lib/cobranca/asaas';
import { comErros } from '../_util';

const FORMAS: FormaPagamento[] = ['UNDEFINED', 'PIX', 'BOLETO', 'CREDIT_CARD'];

/** Contrata ou troca o plano. Só o dono. Devolve o link da fatura; o plano libera quando o pagamento for confirmado. */
export const POST = rota(['dono'], async (req, { sessao }) =>
  comErros(async () => {
    const e = await corpo<{ planoId?: string; vendedores?: number; ciclo?: string; forma?: string; pagador?: DadosPagador }>(req);
    const plano = obterPlano(String(e.planoId ?? ''));
    if (!plano) return Response.json({ erro: 'Escolha um plano.' }, { status: 400 });
    const forma = FORMAS.includes(e.forma as FormaPagamento) ? (e.forma as FormaPagamento) : 'UNDEFINED';
    const pagador = e.pagador
      ? { nome: String(e.pagador.nome ?? ''), cpfCnpj: String(e.pagador.cpfCnpj ?? ''), email: e.pagador.email ? String(e.pagador.email) : sessao.email, celular: e.pagador.celular ? String(e.pagador.celular) : undefined }
      : undefined;
    const r = await assinar(await depsCobranca(), {
      empresaId: sessao.empresaId, planoId: plano.id, vendedores: Number(e.vendedores) || undefined,
      ciclo: e.ciclo === 'anual' ? 'anual' : 'mensal', forma, pagador,
    });
    return Response.json({ faturaUrl: r.faturaUrl, planoId: r.assinatura.planoId });
  }),
);
