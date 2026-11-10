// Créditos do Estúdio: tabela de custo, débito ANTES de gerar e devolução se falhar.
// Funções puras: recebem o saldo/estado e devolvem o novo estado + lançamento do extrato.
import type { LancamentoCredito, TipoCriacao } from './tipos';

/** Custo em créditos por unidade gerada. Slideshow é montado no navegador: custo zero. */
export const CUSTO_CREDITOS: Record<TipoCriacao, number> = {
  foto: 2,
  post: 2,
  video: 25, // ~US$ 0,80 por vídeo de 8 s (Gemini Omni); 10 dava prejuízo no plano de 100 créditos
  slideshow: 0,
  legenda: 0, // legenda já vem junto com o post; avulsa também é grátis
  calendario: 0, // sugestão do mês é grátis; paga-se a arte de cada post
};

export const ROTULO_TIPO: Record<TipoCriacao, string> = {
  foto: 'Foto de produto',
  post: 'Post/arte',
  video: 'Vídeo curto',
  slideshow: 'Slideshow animado',
  legenda: 'Legenda',
  calendario: 'Calendário do mês',
};

export const MAX_VARIACOES = 6;

export function custoDe(tipo: TipoCriacao, quantidade = 1): number {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new Error('Quantidade inválida.');
  }
  if (quantidade > MAX_VARIACOES) {
    throw new Error(`No máximo ${MAX_VARIACOES} variações por vez.`);
  }
  return CUSTO_CREDITOS[tipo] * quantidade;
}

export type ResultadoDebito =
  | { ok: true; saldo: number; lancamento: LancamentoCredito | null }
  | { ok: false; saldo: number; falta: number; mensagem: string };

interface Contexto {
  empresaId: string;
  id: string; // id do lançamento
  quando: string; // ISO
  criacaoId?: string;
}

/** Debita antes de gerar. Nunca deixa o saldo ficar negativo. */
export function debitar(saldo: number, valor: number, motivo: string, ctx: Contexto): ResultadoDebito {
  validarValor(valor);
  validarValor(saldo);
  if (valor === 0) return { ok: true, saldo, lancamento: null };
  if (saldo < valor) {
    const falta = valor - saldo;
    return {
      ok: false,
      saldo,
      falta,
      mensagem: `Faltam ${falta} crédito${falta === 1 ? '' : 's'}. Recarregue para gerar.`,
    };
  }
  const novo = saldo - valor;
  return {
    ok: true,
    saldo: novo,
    lancamento: { ...ctx, tipo: 'debito', valor, saldoDepois: novo, motivo },
  };
}

/**
 * Devolve créditos de uma geração que falhou (total ou parcial).
 * Só devolve o que foi debitado para aquela criação e ainda não foi devolvido.
 */
export function devolver(
  saldo: number,
  extrato: LancamentoCredito[],
  criacaoId: string,
  valor: number,
  motivo: string,
  ctx: Contexto,
): { saldo: number; lancamento: LancamentoCredito | null } {
  validarValor(valor);
  const daCriacao = extrato.filter((l) => l.criacaoId === criacaoId && l.empresaId === ctx.empresaId);
  const debitado = soma(daCriacao.filter((l) => l.tipo === 'debito'));
  const jaDevolvido = soma(daCriacao.filter((l) => l.tipo === 'devolucao'));
  const possivel = Math.min(valor, debitado - jaDevolvido);
  if (possivel <= 0) return { saldo, lancamento: null };
  const novo = saldo + possivel;
  return {
    saldo: novo,
    lancamento: { ...ctx, criacaoId, tipo: 'devolucao', valor: possivel, saldoDepois: novo, motivo },
  };
}

/** Quanto devolver quando só parte das variações saiu. */
export function valorDevolucaoParcial(tipo: TipoCriacao, pedidas: number, entregues: number): number {
  const faltaram = Math.max(0, pedidas - Math.max(0, entregues));
  return CUSTO_CREDITOS[tipo] * faltaram;
}

/** Resumo do extrato de um período (só da empresa pedida). */
export function resumoExtrato(extrato: LancamentoCredito[], empresaId: string) {
  const meus = extrato.filter((l) => l.empresaId === empresaId);
  const gasto = soma(meus.filter((l) => l.tipo === 'debito')) - soma(meus.filter((l) => l.tipo === 'devolucao'));
  const recarregado = soma(meus.filter((l) => l.tipo === 'recarga'));
  const ordenado = [...meus].sort((a, b) => b.quando.localeCompare(a.quando));
  return { gasto, recarregado, lancamentos: ordenado };
}

function soma(ls: LancamentoCredito[]) {
  return ls.reduce((t, l) => t + l.valor, 0);
}

function validarValor(v: number) {
  if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) throw new Error('Valor de crédito inválido.');
}
