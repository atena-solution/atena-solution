// Integração com o Asaas (cobrança). Modo simulado com SIMULAR=1 (padrão quando não há ASAAS_API_KEY).
//
// O que a documentação oficial diz (docs.asaas.com, API v3 — anotado em 01/11/2026, de memória da doc;
// TUDO abaixo precisa ser conferido na conta real → // CONFIRMAR AO VIVO):
//  - Base: produção https://api.asaas.com/v3 ; sandbox https://api-sandbox.asaas.com/v3
//  - Autenticação: cabeçalho `access_token: <chave>` (+ `User-Agent` obrigatório para contas novas).
//  - POST /customers  { name, cpfCnpj, email?, mobilePhone?, externalReference? } → { id: 'cus_...' }
//  - POST /subscriptions { customer, billingType: 'UNDEFINED'|'BOLETO'|'CREDIT_CARD'|'PIX', value, nextDueDate: 'AAAA-MM-DD',
//                          cycle: 'MONTHLY'|'YEARLY', description?, externalReference? } → { id: 'sub_...' }
//  - DELETE /subscriptions/{id} → cancela a assinatura
//  - POST /payments { customer, billingType, value, dueDate: 'AAAA-MM-DD', description?, externalReference? }
//                   → { id: 'pay_...', invoiceUrl, status }
//  - GET /payments/{id} → { id, customer, subscription?, value, netValue, status, dueDate, paymentDate?,
//                           confirmedDate?, externalReference?, invoiceUrl, billingType }
//    status: PENDING | RECEIVED | CONFIRMED | OVERDUE | REFUNDED | RECEIVED_IN_CASH | REFUND_REQUESTED |
//            REFUND_IN_PROGRESS | CHARGEBACK_REQUESTED | CHARGEBACK_DISPUTE | AWAITING_CHARGEBACK_REVERSAL |
//            DUNNING_REQUESTED | DUNNING_RECEIVED | AWAITING_RISK_ANALYSIS
//  - GET /subscriptions/{id}/payments → { data: Pagamento[] }
//  - Webhook: POST com { id?, event: 'PAYMENT_CREATED'|'PAYMENT_CONFIRMED'|'PAYMENT_RECEIVED'|'PAYMENT_OVERDUE'|
//             'PAYMENT_REFUNDED'|'PAYMENT_DELETED'|..., payment: {...} } e cabeçalho `asaas-access-token`
//             com o token definido ao cadastrar o webhook.
//
// IMPORTANTE: o webhook é só GATILHO. Quem libera plano é o que a gente LÊ em GET /payments/{id}.

import { randomUUID } from 'node:crypto';

export type StatusPagamentoAsaas =
  | 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH'
  | 'REFUND_REQUESTED' | 'REFUND_IN_PROGRESS' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE'
  | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';

export type FormaPagamento = 'UNDEFINED' | 'BOLETO' | 'CREDIT_CARD' | 'PIX';

export interface PagamentoAsaas {
  id: string;
  customer: string;
  subscription?: string | null;
  value: number; // reais (decimal)
  status: StatusPagamentoAsaas;
  dueDate: string; // AAAA-MM-DD
  paymentDate?: string | null;
  confirmedDate?: string | null;
  externalReference?: string | null;
  invoiceUrl?: string;
  billingType?: FormaPagamento;
  description?: string;
}

export interface ClienteAsaasEntrada {
  name: string;
  cpfCnpj: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
}

export interface AssinaturaAsaasEntrada {
  customer: string;
  billingType: FormaPagamento;
  value: number;
  nextDueDate: string;
  cycle: 'MONTHLY' | 'YEARLY';
  description?: string;
  externalReference?: string;
}

export interface CobrancaAvulsaEntrada {
  customer: string;
  billingType: FormaPagamento;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}

export interface ClienteAsaasApi {
  criarCliente(e: ClienteAsaasEntrada): Promise<{ id: string }>;
  criarAssinatura(e: AssinaturaAsaasEntrada): Promise<{ id: string }>;
  cancelarAssinatura(id: string): Promise<void>;
  criarCobranca(e: CobrancaAvulsaEntrada): Promise<{ id: string; invoiceUrl?: string }>;
  buscarPagamento(id: string): Promise<PagamentoAsaas | null>;
  listarPagamentosDaAssinatura(id: string): Promise<PagamentoAsaas[]>;
}

export function modoSimulado(env: Record<string, string | undefined> = process.env): boolean {
  return env.SIMULAR === '1' || !env.ASAAS_API_KEY;
}

// ---------------------------------------------------------------- real

export function criarClienteAsaasReal(opcoes: { chave: string; baseUrl?: string; fetch?: typeof fetch }): ClienteAsaasApi {
  const baseUrl = (opcoes.baseUrl ?? 'https://api.asaas.com/v3').replace(/\/$/, '');
  const f = opcoes.fetch ?? fetch;

  async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    const r = await f(`${baseUrl}${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', access_token: opcoes.chave, 'User-Agent': 'atena-solution' }, // CONFIRMAR AO VIVO
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (r.status === 404) return null as T;
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Asaas ${metodo} ${caminho} → ${r.status} ${txt.slice(0, 300)}`);
    }
    return (await r.json()) as T;
  }

  return {
    criarCliente: (e) => chamar('POST', '/customers', e),
    criarAssinatura: (e) => chamar('POST', '/subscriptions', e),
    cancelarAssinatura: async (id) => { await chamar('DELETE', `/subscriptions/${encodeURIComponent(id)}`); },
    criarCobranca: (e) => chamar('POST', '/payments', e),
    buscarPagamento: (id) => chamar('GET', `/payments/${encodeURIComponent(id)}`),
    listarPagamentosDaAssinatura: async (id) =>
      (await chamar<{ data: PagamentoAsaas[] } | null>('GET', `/subscriptions/${encodeURIComponent(id)}/payments`))?.data ?? [],
  };
}

// ---------------------------------------------------------------- simulado

export interface AsaasSimulado extends ClienteAsaasApi {
  /** Muda o status de um pagamento (como se o cliente tivesse pago no Asaas). */
  definirStatus(pagamentoId: string, status: StatusPagamentoAsaas, dataIso?: string): PagamentoAsaas;
  /** Gera a próxima mensalidade de uma assinatura simulada. */
  gerarMensalidade(assinaturaId: string, dueDate: string): PagamentoAsaas;
  pagamentos: Map<string, PagamentoAsaas>;
}

export function criarAsaasSimulado(): AsaasSimulado {
  const clientes = new Map<string, ClienteAsaasEntrada>();
  const assinaturas = new Map<string, AssinaturaAsaasEntrada & { ativa: boolean }>();
  const pagamentos = new Map<string, PagamentoAsaas>();
  const id = (p: string) => `${p}_sim_${randomUUID().slice(0, 8)}`;

  function novaCobranca(e: CobrancaAvulsaEntrada, subscription?: string): PagamentoAsaas {
    const pid = id('pay');
    const p: PagamentoAsaas = {
      id: pid, customer: e.customer, subscription: subscription ?? null, value: e.value, status: 'PENDING',
      dueDate: e.dueDate, externalReference: e.externalReference ?? null, description: e.description,
      billingType: e.billingType, invoiceUrl: `/api/cobranca/simular?pagamento=${pid}`,
    };
    pagamentos.set(pid, p);
    return p;
  }

  return {
    pagamentos,
    async criarCliente(e) {
      const cid = id('cus');
      clientes.set(cid, e);
      return { id: cid };
    },
    async criarAssinatura(e) {
      if (!clientes.has(e.customer)) throw new Error('Cliente inexistente (simulado)');
      const sid = id('sub');
      assinaturas.set(sid, { ...e, ativa: true });
      novaCobranca({ customer: e.customer, billingType: e.billingType, value: e.value, dueDate: e.nextDueDate, description: e.description, externalReference: e.externalReference }, sid);
      return { id: sid };
    },
    async cancelarAssinatura(sid) {
      const s = assinaturas.get(sid);
      if (s) s.ativa = false;
    },
    async criarCobranca(e) {
      if (!clientes.has(e.customer)) throw new Error('Cliente inexistente (simulado)');
      const p = novaCobranca(e);
      return { id: p.id, invoiceUrl: p.invoiceUrl };
    },
    async buscarPagamento(pid) {
      const p = pagamentos.get(pid);
      return p ? { ...p } : null;
    },
    async listarPagamentosDaAssinatura(sid) {
      return [...pagamentos.values()].filter((p) => p.subscription === sid).map((p) => ({ ...p }));
    },
    definirStatus(pid, status, dataIso) {
      const p = pagamentos.get(pid);
      if (!p) throw new Error(`Pagamento ${pid} não existe (simulado)`);
      p.status = status;
      if (status === 'CONFIRMED' || status === 'RECEIVED') {
        const d = (dataIso ?? new Date().toISOString()).slice(0, 10);
        p.confirmedDate = d;
        if (status === 'RECEIVED') p.paymentDate = d;
      }
      return { ...p };
    },
    gerarMensalidade(sid, dueDate) {
      const s = assinaturas.get(sid);
      if (!s) throw new Error('Assinatura inexistente (simulado)');
      return novaCobranca({ customer: s.customer, billingType: s.billingType, value: s.value, dueDate, description: s.description, externalReference: s.externalReference }, sid);
    },
  };
}

// Instância única por processo (no modo simulado guarda tudo em memória; sobrevive ao recarregar do dev).
const g = globalThis as unknown as { __atenaAsaas?: ClienteAsaasApi; __atenaAsaasSim?: AsaasSimulado | null };

export function asaas(env: Record<string, string | undefined> = process.env): ClienteAsaasApi {
  if (g.__atenaAsaas) return g.__atenaAsaas;
  if (modoSimulado(env)) {
    g.__atenaAsaasSim = criarAsaasSimulado();
    g.__atenaAsaas = g.__atenaAsaasSim;
  } else {
    g.__atenaAsaasSim = null;
    g.__atenaAsaas = criarClienteAsaasReal({ chave: env.ASAAS_API_KEY!, baseUrl: env.ASAAS_BASE_URL });
  }
  return g.__atenaAsaas;
}

/** Só existe no modo simulado. */
export function asaasSimulado(): AsaasSimulado | null {
  asaas();
  return g.__atenaAsaasSim ?? null;
}
