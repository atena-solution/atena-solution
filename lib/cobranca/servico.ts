// Cobrança — orquestra Asaas + repositório + regras puras.
// Rotas em app/api/cobranca/* chamam estas funções. Nenhuma recebe empresaId do navegador sem
// passar antes por `exigirEmpresa` (Base): o empresaId aqui já é o do usuário logado.

import { timingSafeEqual } from 'node:crypto';
import { novaAssinaturaDeTeste, situacaoAcesso, type Assinatura, type SituacaoAcesso } from '../planos/acesso';
import { CONFIG_PLANOS, type ConfigPlanos, type PlanoId } from '../planos/config';
import { dataSP, maisTarde } from '../planos/datas';
import { calcularPreco, centavosParaReais, exigirPlano, obterPacote, type Ciclo } from '../planos/preco';
import type { ClienteAsaasApi, FormaPagamento } from './asaas';
import { documentoValido, soDigitos } from './documento';
import { decidir, lerReferencia, montarReferencia } from './liberacao';
import type { RepositorioCobranca } from './repositorio';

export interface Deps {
  repo: RepositorioCobranca;
  asaas: ClienteAsaasApi;
  agora?: () => string;
  cfg?: ConfigPlanos;
}

const agoraDe = (d: Deps) => (d.agora ? d.agora() : new Date().toISOString());
const cfgDe = (d: Deps) => d.cfg ?? CONFIG_PLANOS;

export class ErroCobranca extends Error {
  constructor(public codigo: string, mensagem: string) { super(mensagem); }
}

export interface DadosPagador {
  nome: string;
  cpfCnpj: string;
  email?: string;
  celular?: string;
}

/** Cria o teste grátis na criação da empresa (onboarding). Não faz nada se já existe assinatura. */
export async function iniciarTeste(d: Deps, empresaId: string, planoEscolhido?: PlanoId): Promise<Assinatura> {
  const atual = await d.repo.obterAssinatura(empresaId);
  if (atual) return atual;
  const a = novaAssinaturaDeTeste(empresaId, agoraDe(d), cfgDe(d), planoEscolhido);
  await d.repo.salvarAssinatura(a);
  await d.repo.gravarAbasDaEmpresa(empresaId, exigirPlano(cfgDe(d).planoDoTeste, cfgDe(d)).abas);
  return a;
}

/**
 * Assinatura da empresa; se ainda não tem (demo, empresa criada pelo onboarding da Base),
 * começa o teste grátis contado da data de criação da empresa.
 */
export async function assinaturaOuTeste(d: Deps, empresaId: string, criadoEm?: string): Promise<Assinatura | null> {
  const atual = await d.repo.obterAssinatura(empresaId);
  if (atual || !criadoEm) return atual;
  return iniciarTeste({ ...d, agora: () => criadoEm }, empresaId);
}

async function garantirCliente(d: Deps, a: Assinatura, pagador?: DadosPagador): Promise<Assinatura> {
  if (a.asaasClienteId) return a;
  if (!pagador) throw new ErroCobranca('dados_pagador', 'Informe nome e CPF/CNPJ para gerar a cobrança.');
  if (!pagador.nome?.trim()) throw new ErroCobranca('nome', 'Informe o nome do responsável ou da empresa.');
  if (!documentoValido(pagador.cpfCnpj)) throw new ErroCobranca('cpf_cnpj', 'CPF ou CNPJ inválido.');
  const c = await d.asaas.criarCliente({
    name: pagador.nome.trim(),
    cpfCnpj: soDigitos(pagador.cpfCnpj),
    email: pagador.email?.trim() || undefined,
    mobilePhone: pagador.celular ? soDigitos(pagador.celular).replace(/^55(?=\d{10,11}$)/, '') : undefined, // CONFIRMAR AO VIVO: formato do celular
    externalReference: `atena:empresa:${a.empresaId}`,
  });
  return { ...a, asaasClienteId: c.id };
}

export interface PedidoAssinatura {
  empresaId: string;
  planoId: PlanoId;
  vendedores?: number;
  ciclo?: Ciclo;
  forma?: FormaPagamento;
  pagador?: DadosPagador;
}

/** Contrata (ou troca) o plano. Não libera nada: só cria a cobrança. Libera quando o pagamento for lido como pago. */
export async function assinar(d: Deps, p: PedidoAssinatura): Promise<{ assinatura: Assinatura; faturaUrl?: string }> {
  const cfg = cfgDe(d);
  const agora = agoraDe(d);
  const orc = calcularPreco({ planoId: p.planoId, vendedores: p.vendedores, ciclo: p.ciclo }, cfg);
  const plano = exigirPlano(p.planoId, cfg);

  let a = (await d.repo.obterAssinatura(p.empresaId)) ?? novaAssinaturaDeTeste(p.empresaId, agora, cfg);
  a = await garantirCliente(d, a, p.pagador);

  // Troca de plano: cancela a assinatura antiga no Asaas. O período já pago continua valendo.
  if (a.asaasAssinaturaId) await d.asaas.cancelarAssinatura(a.asaasAssinaturaId);

  // 1º vencimento: no fim do que já está liberado (teste ou pago), ou hoje.
  const inicio = maisTarde(agora, maisTarde(a.testeAte, a.pagoAte))!;
  const sub = await d.asaas.criarAssinatura({
    customer: a.asaasClienteId!,
    billingType: p.forma ?? 'UNDEFINED', // UNDEFINED = cliente escolhe Pix, boleto ou cartão na fatura
    value: centavosParaReais(orc.valorCobrado),
    nextDueDate: dataSP(inicio),
    cycle: orc.ciclo === 'anual' ? 'YEARLY' : 'MONTHLY',
    description: `ATENA SOLUTION — ${plano.nome}${orc.vendedores ? ` (${orc.vendedores} vendedores)` : ''}`,
    externalReference: montarReferencia({ tipo: 'assinatura', empresaId: p.empresaId }),
  });

  const faturas = await d.asaas.listarPagamentosDaAssinatura(sub.id);
  const aberta = faturas.find((f) => f.status === 'PENDING' || f.status === 'OVERDUE');
  a = {
    ...a, planoId: plano.id, vendedores: orc.vendedores, ciclo: orc.ciclo, asaasAssinaturaId: sub.id,
    canceladaEm: undefined, faturaAbertaUrl: aberta?.invoiceUrl, atualizadoEm: agora,
  };
  await d.repo.salvarAssinatura(a);
  return { assinatura: a, faturaUrl: aberta?.invoiceUrl };
}

export async function comprarCreditos(
  d: Deps, empresaId: string, pacoteId: string, pagador?: DadosPagador, forma: FormaPagamento = 'UNDEFINED',
): Promise<{ faturaUrl?: string; pagamentoId: string }> {
  const pacote = obterPacote(pacoteId, cfgDe(d));
  if (!pacote) throw new ErroCobranca('pacote', 'Pacote de créditos não encontrado.');
  let a = await d.repo.obterAssinatura(empresaId);
  if (!a) throw new ErroCobranca('sem_plano', 'Crie a conta antes de comprar créditos.');
  const comCliente = await garantirCliente(d, a, pagador);
  if (comCliente !== a) { a = comCliente; await d.repo.salvarAssinatura({ ...a, atualizadoEm: agoraDe(d) }); }
  const c = await d.asaas.criarCobranca({
    customer: a.asaasClienteId!, billingType: forma, value: centavosParaReais(pacote.preco),
    dueDate: dataSP(agoraDe(d)), description: `ATENA SOLUTION — ${pacote.creditos} créditos do Estúdio`,
    externalReference: montarReferencia({ tipo: 'creditos', empresaId, pacoteId }),
  });
  return { faturaUrl: c.invoiceUrl, pagamentoId: c.id };
}

export async function cancelar(d: Deps, empresaId: string): Promise<Assinatura> {
  const a = await d.repo.obterAssinatura(empresaId);
  if (!a) throw new ErroCobranca('sem_plano', 'Não há assinatura para cancelar.');
  if (a.asaasAssinaturaId) await d.asaas.cancelarAssinatura(a.asaasAssinaturaId);
  const nova = { ...a, canceladaEm: agoraDe(d), asaasAssinaturaId: undefined, faturaAbertaUrl: undefined, atualizadoEm: agoraDe(d) };
  await d.repo.salvarAssinatura(nova);
  return nova;
}

export interface ResultadoProcessamento { pagamentoId: string; resultado: 'aplicado' | 'nada' | 'recusado' | 'nao_encontrado'; resumo: string }

/**
 * Processa um pagamento LENDO-O NA API do Asaas. É a única porta que libera plano ou créditos.
 * Pode ser chamada quantas vezes quiser (webhook repetido, botão "Já paguei", rotina diária).
 */
export async function processarPagamento(d: Deps, pagamentoId: string): Promise<ResultadoProcessamento> {
  const pag = await d.asaas.buscarPagamento(pagamentoId);
  if (!pag) return { pagamentoId, resultado: 'nao_encontrado', resumo: 'Pagamento não existe no Asaas.' };
  const ref = lerReferencia(pag.externalReference);
  if (!ref) return { pagamentoId, resultado: 'nada', resumo: 'Cobrança não é da Atena.' };

  let decisao: ReturnType<typeof decidir> | null = null;
  await d.repo.transacao(ref.empresaId, pag.id, (estado) => {
    decisao = decidir(pag, estado, agoraDe(d), cfgDe(d));
    return decisao.acao === 'aplicar' ? decisao.mudancas : null;
  });
  const dec = decisao as ReturnType<typeof decidir> | null;
  if (!dec) return { pagamentoId, resultado: 'nada', resumo: 'Sem decisão.' };

  if (dec.acao === 'recusar') {
    await d.repo.alertar({ empresaId: ref.empresaId, pagamentoId, motivo: dec.motivo, quando: agoraDe(d) });
    return { pagamentoId, resultado: 'recusado', resumo: dec.motivo };
  }
  if (dec.acao === 'nada') return { pagamentoId, resultado: 'nada', resumo: dec.motivo };

  if (dec.mudancas.assinatura) await d.repo.gravarAbasDaEmpresa(ref.empresaId, exigirPlano(dec.mudancas.assinatura.planoId, cfgDe(d)).abas);
  return { pagamentoId, resultado: 'aplicado', resumo: dec.resumo };
}

/** Botão "Já paguei" / rotina diária: relê todas as mensalidades da assinatura atual. */
export async function sincronizar(d: Deps, empresaId: string): Promise<ResultadoProcessamento[]> {
  const a = await d.repo.obterAssinatura(empresaId);
  if (!a?.asaasAssinaturaId) return [];
  const lista = await d.asaas.listarPagamentosDaAssinatura(a.asaasAssinaturaId);
  const out: ResultadoProcessamento[] = [];
  for (const p of lista) out.push(await processarPagamento(d, p.id));
  // Atualiza o link da fatura em aberto.
  const aberta = lista.find((f) => f.status === 'PENDING' || f.status === 'OVERDUE');
  const atual = await d.repo.obterAssinatura(empresaId);
  if (atual && atual.faturaAbertaUrl !== aberta?.invoiceUrl) await d.repo.salvarAssinatura({ ...atual, faturaAbertaUrl: aberta?.invoiceUrl, atualizadoEm: agoraDe(d) });
  return out;
}

// ---------------------------------------------------------------- webhook

export function tokenWebhookConfere(recebido: string | null | undefined, esperado: string | undefined): boolean {
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Extrai só o id do pagamento do corpo do webhook. O resto do corpo é IGNORADO (não confiamos nele). */
export function pagamentoIdDoWebhook(corpo: unknown): string | null {
  const c = corpo as { payment?: { id?: unknown } } | null;
  const id = c?.payment?.id;
  return typeof id === 'string' && /^[A-Za-z0-9_-]{3,80}$/.test(id) ? id : null;
}

export async function processarWebhook(
  d: Deps, entrada: { token: string | null; corpo: unknown; tokenEsperado: string | undefined },
): Promise<{ status: number; resultado?: ResultadoProcessamento }> {
  if (!tokenWebhookConfere(entrada.token, entrada.tokenEsperado)) return { status: 401 };
  const id = pagamentoIdDoWebhook(entrada.corpo);
  if (!id) return { status: 200 }; // evento sem pagamento: só confirma recebimento
  return { status: 200, resultado: await processarPagamento(d, id) };
}

// ---------------------------------------------------------------- leitura

export async function lerAcesso(d: Deps, empresaId: string): Promise<SituacaoAcesso> {
  return situacaoAcesso(await d.repo.obterAssinatura(empresaId), agoraDe(d), cfgDe(d));
}
