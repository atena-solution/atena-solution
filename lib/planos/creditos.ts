// Créditos do Estúdio — entrada de créditos (plano mensal e pacotes avulsos). Funções puras.
// O débito/devolução por geração é da sessão D (lib/estudio); o saldo é um número só:
// `Empresa.plano.creditos` (contrato da Base). Cada movimento vira um registro no extrato
// `empresas/{empresaId}/creditos/{movimentoId}` — o id do movimento é o id do pagamento,
// o que torna a entrada IDEMPOTENTE (o mesmo pagamento nunca credita duas vezes).
//
// Regra comercial: créditos não expiram enquanto a empresa tiver plano.

export type OrigemCredito = 'plano_mensal' | 'pacote' | 'estorno' | 'cortesia' | 'uso' | 'devolucao';

export interface MovimentoCredito {
  id: string;
  empresaId: string;
  origem: OrigemCredito;
  quantidade: number; // positivo = entra, negativo = sai
  saldoDepois: number;
  descricao: string;
  referencia?: string; // id do pagamento no Asaas, id da criação etc.
  quando: string;
}

export interface ResultadoCredito {
  saldo: number;
  movimento: MovimentoCredito | null; // null = nada a fazer (já aplicado)
}

export function aplicarMovimento(
  saldoAtual: number,
  idsJaAplicados: ReadonlySet<string>,
  mov: Omit<MovimentoCredito, 'saldoDepois'>,
): ResultadoCredito {
  if (!Number.isInteger(mov.quantidade)) throw new Error('Quantidade de créditos deve ser inteira.');
  if (idsJaAplicados.has(mov.id)) return { saldo: saldoAtual, movimento: null };
  // Estorno nunca deixa o saldo negativo: se o cliente já gastou, zera.
  const saldo = Math.max(0, saldoAtual + mov.quantidade);
  const quantidade = saldo - saldoAtual;
  return { saldo, movimento: { ...mov, quantidade, saldoDepois: saldo } };
}

export function temCreditos(saldo: number, custo: number): boolean {
  return custo <= 0 || saldo >= custo;
}
