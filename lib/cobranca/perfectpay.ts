// Perfect Pay — cobrança da Atena (04/11/2026). Produto "Atena Solution" PPPBFM11 (docs/perfectpay.md).
// Mesmo jeito do ERP LB (lb-erp/lib/perfectpay.js, testado até o checkout):
//  - API: POST https://app.perfectpay.com.br/api/v1/sales/get {transaction_token | email, page} com Authorization: Bearer <PERFECTPAY_API_KEY>
//    → { sales: { data: [ { transaction_token, value, sale_status ('approved'…), plan:[{plan_code}], customer:[{email}], metadata:{src} } ] } }
//  - PostBack: { token (fixo da conta = PERFECTPAY_TOKEN), code, sale_status_enum (2 = aprovado), metadata{src} }
// Nada libera pelo corpo do webhook: a venda é sempre lida na API. A venda vira um "pagamento" no formato do Asaas e passa
// pela MESMA regra de liberação (lib/cobranca/liberacao.ts), com o id `pp_<transaction_token>` (idempotente).
// CONFIRMAR AO VIVO: nomes de status de estorno e a data da venda; se a renovação da assinatura traz o mesmo `src`.

import type { Ciclo } from '../planos/preco';
import type { PlanoId } from '../planos/config';
import type { PagamentoAsaas, StatusPagamentoAsaas } from './asaas';

export const PP_BASE = 'https://app.perfectpay.com.br/api';

export type ItemPP =
  | { tipo: 'plano'; planoId: PlanoId; ciclo: Ciclo; link: string }
  | { tipo: 'creditos'; pacoteId: string; link: string };

/** Código do plano na Perfect Pay → o que ele libera + link do checkout. */
export const PP_ITENS: Record<string, ItemPP> = {
  PPLQQQTPP: { tipo: 'plano', planoId: 'atendimento', ciclo: 'mensal', link: 'https://go.perfectpay.com.br/PPU38CQHGGU' },
  PPLQQQTPQ: { tipo: 'plano', planoId: 'coach', ciclo: 'mensal', link: 'https://go.perfectpay.com.br/PPU38CQHGH0' },
  PPLQQQTPR: { tipo: 'plano', planoId: 'estudio', ciclo: 'mensal', link: 'https://go.perfectpay.com.br/PPU38CQHGH1' },
  PPLQQQTPS: { tipo: 'plano', planoId: 'completo', ciclo: 'mensal', link: 'https://go.perfectpay.com.br/PPU38CQHGH2' },
  PPLQQQTPT: { tipo: 'plano', planoId: 'atendimento', ciclo: 'anual', link: 'https://go.perfectpay.com.br/PPU38CQHGH3' },
  PPLQQQTPU: { tipo: 'plano', planoId: 'coach', ciclo: 'anual', link: 'https://go.perfectpay.com.br/PPU38CQHGH4' },
  PPLQQQTPV: { tipo: 'plano', planoId: 'estudio', ciclo: 'anual', link: 'https://go.perfectpay.com.br/PPU38CQHGH5' },
  PPLQQQTQ0: { tipo: 'plano', planoId: 'completo', ciclo: 'anual', link: 'https://go.perfectpay.com.br/PPU38CQHGH7' },
  PPLQQQTQ1: { tipo: 'creditos', pacoteId: 'creditos-50', link: 'https://go.perfectpay.com.br/PPU38CQHGH8' },
  PPLQQQTQ2: { tipo: 'creditos', pacoteId: 'creditos-150', link: 'https://go.perfectpay.com.br/PPU38CQHGH9' },
  PPLQQQTQ3: { tipo: 'creditos', pacoteId: 'creditos-400', link: 'https://go.perfectpay.com.br/PPU38CQHGHA' },
};

export const ppLigado = (env: Record<string, string | undefined> = process.env) => Boolean(env.PERFECTPAY_API_KEY);

/** Plano que a Perfect Pay vende: só o número de vendedores incluso (o vendedor extra ainda é combinado à parte). */
export function codigoDoPlano(planoId: PlanoId, ciclo: Ciclo): string | null {
  return Object.keys(PP_ITENS).find((k) => { const i = PP_ITENS[k]; return i.tipo === 'plano' && i.planoId === planoId && i.ciclo === ciclo; }) ?? null;
}
export function codigoDoPacote(pacoteId: string): string | null {
  return Object.keys(PP_ITENS).find((k) => { const i = PP_ITENS[k]; return i.tipo === 'creditos' && i.pacoteId === pacoteId; }) ?? null;
}

/** Link do checkout com o nosso pedido no `src` (volta em metadata.src na consulta e no postback). */
export function linkCheckout(codigo: string, src: string): string | null {
  const item = PP_ITENS[codigo];
  if (!item) return null;
  const u = new URL(item.link);
  u.searchParams.set('src', src);
  return u.toString();
}

// ---------------------------------------------------------------- venda (formato da API)

export interface VendaPP {
  transaction_token?: string;
  value?: number | string;
  sale_status?: string;
  sale_status_enum?: number;
  plan?: { plan_code?: string }[] | { code?: string };
  customer?: { email?: string }[] | { email?: string };
  metadata?: { src?: string } | null;
  date_approved?: string;
  date_created?: string;
}

export const valorNum = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (/,\d{1,2}$/.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'));
  return Number(s.replace(/,/g, ''));
};
export const planoDaVenda = (v: VendaPP): string | null => (Array.isArray(v?.plan) ? v.plan[0]?.plan_code : (v?.plan as { code?: string } | undefined)?.code) ?? null;
export const emailDaVenda = (v: VendaPP): string => String((Array.isArray(v?.customer) ? v.customer[0]?.email : (v?.customer as { email?: string } | undefined)?.email) ?? '').toLowerCase().trim();
export const itemDaVenda = (v: VendaPP): ItemPP | null => PP_ITENS[planoDaVenda(v) ?? ''] ?? null;

const ESTORNO = ['refunded', 'chargeback', 'chargedback', 'charged_back', 'refund'];

/** Status da Perfect Pay → status do Asaas usado pela regra de liberação. */
export function statusDaVenda(v: VendaPP): StatusPagamentoAsaas {
  const s = String(v?.sale_status ?? '').toLowerCase();
  if (s === 'approved' || s === 'completed') return 'RECEIVED';
  if (ESTORNO.some((x) => s.includes(x))) return 'REFUNDED';
  return 'PENDING';
}

/** Postback veio da nossa conta? */
export const postbackValido = (body: { token?: unknown } | null | undefined, env: Record<string, string | undefined> = process.env) =>
  Boolean(env.PERFECTPAY_TOKEN) && String(body?.token ?? '') === String(env.PERFECTPAY_TOKEN);

/**
 * Venda → "pagamento" no formato do Asaas (para a regra única de liberação).
 * `inicioPeriodo` = de onde conta o período pago (fim do teste/do que já está pago, ou hoje).
 */
export function vendaParaPagamento(v: VendaPP, referencia: string, inicioPeriodo: string): (PagamentoAsaas & { provedor: 'perfectpay'; planoAtena?: { planoId: PlanoId; ciclo: Ciclo } }) | null {
  const token = String(v?.transaction_token ?? '');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(token)) return null;
  const item = itemDaVenda(v);
  return {
    id: `pp_${token}`,
    customer: 'perfectpay',
    value: valorNum(v.value),
    status: statusDaVenda(v),
    dueDate: inicioPeriodo.slice(0, 10),
    externalReference: referencia,
    provedor: 'perfectpay',
    planoAtena: item?.tipo === 'plano' ? { planoId: item.planoId, ciclo: item.ciclo } : undefined,
  };
}

// ---------------------------------------------------------------- API

export interface ClientePP {
  buscarVenda(code: string): Promise<VendaPP | null>;
  vendasDoEmail(email: string): Promise<VendaPP[]>;
}

export function perfectpay(env: Record<string, string | undefined> = process.env, f: typeof fetch = fetch): ClientePP {
  async function chamar(corpo: object): Promise<VendaPP[]> {
    const r = await f(`${PP_BASE}/v1/sales/get`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.PERFECTPAY_API_KEY}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const d = (await r.json().catch(() => ({}))) as { sales?: { data?: VendaPP[] } };
    if (!r.ok) throw new Error(`PerfectPay ${r.status}`);
    return d?.sales?.data ?? [];
  }
  return {
    async buscarVenda(code) { return (await chamar({ transaction_token: code }))[0] ?? null; },
    async vendasDoEmail(email) { return chamar({ email, paginate: 50, page: 1 }); },
  };
}
