// Regra de liberação — funções puras.
// Recebe o pagamento COMO FOI LIDO na API do Asaas (nunca o corpo do webhook) e o estado atual
// da empresa, e decide o que muda. Idempotente: o mesmo pagamento nunca libera/credita duas vezes.

import type { Assinatura } from '../planos/acesso';
import { CONFIG_PLANOS, type ConfigPlanos, type PlanoId } from '../planos/config';
import { aplicarMovimento, type MovimentoCredito } from '../planos/creditos';
import { fimDoDiaSP, maisTarde, somarMeses } from '../planos/datas';
import { obterPacote, obterPlano } from '../planos/preco';
import type { PagamentoAsaas, StatusPagamentoAsaas } from './asaas';

// ---------------------------------------------------------------- referência externa
// Vai no `externalReference` de toda cobrança criada pela Atena. Diz de qual empresa é e o que é.

export type Referencia =
  | { tipo: 'assinatura'; empresaId: string }
  | { tipo: 'creditos'; empresaId: string; pacoteId: string };

export function montarReferencia(r: Referencia): string {
  return r.tipo === 'assinatura' ? `atena:assinatura:${r.empresaId}` : `atena:creditos:${r.pacoteId}:${r.empresaId}`;
}

export function lerReferencia(txt: string | null | undefined): Referencia | null {
  if (!txt) return null;
  const p = txt.split(':');
  if (p[0] !== 'atena') return null;
  if (p[1] === 'assinatura' && p.length === 3 && p[2]) return { tipo: 'assinatura', empresaId: p[2] };
  if (p[1] === 'creditos' && p.length === 4 && p[2] && p[3]) return { tipo: 'creditos', pacoteId: p[2], empresaId: p[3] };
  return null;
}

// ---------------------------------------------------------------- status

const PAGO: StatusPagamentoAsaas[] = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED'];
const DESFEITO: StatusPagamentoAsaas[] = ['REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL'];

export function estaPago(s: StatusPagamentoAsaas): boolean { return PAGO.includes(s); }
export function foiDesfeito(s: StatusPagamentoAsaas): boolean { return DESFEITO.includes(s); }

// ---------------------------------------------------------------- estado e decisão

/** Guardado em `empresas/{empresaId}/pagamentos/{pagamentoId}`. */
export interface RegistroPagamento {
  pagamentoId: string;
  empresaId: string;
  tipo: Referencia['tipo'];
  efeito: 'liberado' | 'estornado';
  valor: number; // reais
  status: StatusPagamentoAsaas;
  /** pagoAte antes deste pagamento (para estornar certinho). */
  pagoAteAntes?: string;
  pagoAteDepois?: string;
  creditos?: number;
  quando: string;
}

export interface EstadoCobranca {
  empresaId: string;
  assinatura: Assinatura | null;
  saldoCreditos: number;
  /** Registro deste pagamento, se já foi processado antes. */
  registro: RegistroPagamento | null;
}

export interface Mudancas {
  assinatura?: Assinatura;
  saldoCreditos?: number;
  movimento?: MovimentoCredito;
  registro?: RegistroPagamento;
}

export type Decisao =
  | { acao: 'nada'; motivo: string }
  | { acao: 'recusar'; motivo: string } // algo errado (empresa trocada, valor errado): registrar alerta pro admin
  | { acao: 'aplicar'; resumo: string; mudancas: Mudancas };

export function decidir(
  pag: PagamentoAsaas,
  estado: EstadoCobranca,
  agoraIso: string,
  cfg: ConfigPlanos = CONFIG_PLANOS,
): Decisao {
  const ref = lerReferencia(pag.externalReference);
  if (!ref) return { acao: 'nada', motivo: 'Cobrança sem referência da Atena.' };
  if (ref.empresaId !== estado.empresaId) return { acao: 'recusar', motivo: 'Pagamento de outra empresa.' };

  // A empresa precisa ser dona do cliente Asaas do pagamento (impede usar a cobrança de outra empresa).
  const a = estado.assinatura;
  if (!a?.asaasClienteId || a.asaasClienteId !== pag.customer)
    return { acao: 'recusar', motivo: 'Cliente do Asaas não corresponde à empresa.' };

  const reg = estado.registro;

  if (estaPago(pag.status)) {
    if (reg) return { acao: 'nada', motivo: 'Pagamento já processado.' };
    return ref.tipo === 'assinatura' ? liberarPeriodo(pag, a, estado, agoraIso, cfg) : creditarPacote(pag, ref.pacoteId, estado, agoraIso, cfg);
  }

  if (foiDesfeito(pag.status)) {
    if (!reg) return { acao: 'nada', motivo: 'Estorno de pagamento que nunca liberou nada.' };
    if (reg.efeito === 'estornado') return { acao: 'nada', motivo: 'Estorno já processado.' };
    return desfazer(pag, a, reg, estado, agoraIso);
  }

  return { acao: 'nada', motivo: `Status ${pag.status}: aguardando pagamento.` };
}

function liberarPeriodo(pag: PagamentoAsaas, a: Assinatura, estado: EstadoCobranca, agoraIso: string, cfg: ConfigPlanos): Decisao {
  if (pag.subscription && a.asaasAssinaturaId && pag.subscription !== a.asaasAssinaturaId)
    return { acao: 'recusar', motivo: 'Mensalidade de uma assinatura antiga ou de outra empresa.' };
  if (!(pag.value > 0)) return { acao: 'recusar', motivo: 'Valor inválido.' };

  const plano = obterPlano(a.planoId, cfg);
  if (!plano) return { acao: 'recusar', motivo: `Plano ${a.planoId} não existe mais na configuração.` };

  const meses = a.ciclo === 'anual' ? 12 : 1;
  // O período pago começa no vencimento da cobrança (o 1º vencimento é o fim do teste grátis).
  const fimPeriodo = somarMeses(fimDoDiaSP(pag.dueDate), meses);
  const pagoAteDepois = maisTarde(a.pagoAte, fimPeriodo)!;
  const assinatura: Assinatura = { ...a, pagoAte: pagoAteDepois, faturaAbertaUrl: undefined, atualizadoEm: agoraIso };

  const mudancas: Mudancas = { assinatura };
  const creditos = plano.creditosMensais * meses;
  if (creditos > 0) {
    const r = aplicarMovimento(estado.saldoCreditos, new Set(), {
      id: pag.id, empresaId: estado.empresaId, origem: 'plano_mensal', quantidade: creditos,
      descricao: `Créditos do plano ${plano.nome}`, referencia: pag.id, quando: agoraIso,
    });
    mudancas.saldoCreditos = r.saldo;
    mudancas.movimento = r.movimento ?? undefined;
  }
  mudancas.registro = {
    pagamentoId: pag.id, empresaId: estado.empresaId, tipo: 'assinatura', efeito: 'liberado', valor: pag.value,
    status: pag.status, pagoAteAntes: a.pagoAte, pagoAteDepois, creditos: creditos || undefined, quando: agoraIso,
  };
  return { acao: 'aplicar', resumo: `Plano ${plano.nome} liberado até ${pagoAteDepois.slice(0, 10)}.`, mudancas };
}

function creditarPacote(pag: PagamentoAsaas, pacoteId: string, estado: EstadoCobranca, agoraIso: string, cfg: ConfigPlanos): Decisao {
  const pacote = obterPacote(pacoteId, cfg);
  if (!pacote) return { acao: 'recusar', motivo: `Pacote ${pacoteId} não existe.` };
  // Valor pago tem que cobrir o preço do pacote (tolerância de 1 centavo).
  if (Math.round(pag.value * 100) + 1 < pacote.preco) return { acao: 'recusar', motivo: 'Valor pago menor que o preço do pacote.' };
  const r = aplicarMovimento(estado.saldoCreditos, new Set(), {
    id: pag.id, empresaId: estado.empresaId, origem: 'pacote', quantidade: pacote.creditos,
    descricao: `Pacote de ${pacote.creditos} créditos`, referencia: pag.id, quando: agoraIso,
  });
  return {
    acao: 'aplicar',
    resumo: `${pacote.creditos} créditos adicionados.`,
    mudancas: {
      saldoCreditos: r.saldo, movimento: r.movimento ?? undefined,
      registro: { pagamentoId: pag.id, empresaId: estado.empresaId, tipo: 'creditos', efeito: 'liberado', valor: pag.value, status: pag.status, creditos: pacote.creditos, quando: agoraIso },
    },
  };
}

function desfazer(pag: PagamentoAsaas, a: Assinatura, reg: RegistroPagamento, estado: EstadoCobranca, agoraIso: string): Decisao {
  const mudancas: Mudancas = {};
  if (reg.tipo === 'assinatura' && reg.pagoAteDepois) {
    // Volta o pagoAte só se este pagamento ainda é o último que estendeu o acesso.
    if (a.pagoAte === reg.pagoAteDepois) mudancas.assinatura = { ...a, pagoAte: reg.pagoAteAntes, atualizadoEm: agoraIso };
  }
  if (reg.creditos) {
    const r = aplicarMovimento(estado.saldoCreditos, new Set(), {
      id: `${pag.id}:estorno`, empresaId: estado.empresaId, origem: 'estorno', quantidade: -reg.creditos,
      descricao: 'Estorno de pagamento', referencia: pag.id, quando: agoraIso,
    });
    mudancas.saldoCreditos = r.saldo;
    mudancas.movimento = r.movimento ?? undefined;
  }
  mudancas.registro = { ...reg, efeito: 'estornado', status: pag.status, quando: agoraIso };
  return { acao: 'aplicar', resumo: 'Pagamento estornado: acesso e créditos ajustados.', mudancas };
}

/** Plano trocado (upgrade/downgrade): vale a partir da próxima mensalidade; o valor novo vai pro Asaas. */
export function trocarPlano(a: Assinatura, planoId: PlanoId, vendedores: number, agoraIso: string): Assinatura {
  return { ...a, planoId, vendedores, atualizadoEm: agoraIso };
}
