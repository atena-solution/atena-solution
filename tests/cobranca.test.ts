import { beforeEach, describe, expect, it } from 'vitest';
import { criarAsaasSimulado, type AsaasSimulado } from '../lib/cobranca/asaas';
import { criarRepositorioMemoria, type RepositorioCobranca } from '../lib/cobranca/repositorio';
import { assinar, cancelar, comprarCreditos, iniciarTeste, lerAcesso, processarPagamento, processarWebhook, sincronizar, pagamentoIdDoWebhook, tokenWebhookConfere, type Deps } from '../lib/cobranca/servico';
import { lerReferencia, montarReferencia, decidir } from '../lib/cobranca/liberacao';
import { cpfValido, cnpjValido, documentoValido } from '../lib/cobranca/documento';

const T0 = '2026-11-01T12:00:00.000Z';
const PAGADOR = { nome: 'Barbearia Topetes', cpfCnpj: '11.222.333/0001-81', email: 'dono@topetes.com' };

let asaas: AsaasSimulado;
let repo: RepositorioCobranca;
let agora: string;
let d: Deps;

beforeEach(() => {
  asaas = criarAsaasSimulado();
  repo = criarRepositorioMemoria();
  agora = T0;
  d = { asaas, repo, agora: () => agora };
});

async function pagamentoAberto(empresaId: string) {
  const a = await repo.obterAssinatura(empresaId);
  const lista = await asaas.listarPagamentosDaAssinatura(a!.asaasAssinaturaId!);
  return lista.find((p) => p.status === 'PENDING')!;
}

describe('documento', () => {
  it('valida CPF e CNPJ', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-82')).toBe(false);
    expect(documentoValido('123')).toBe(false);
  });
});

describe('referência externa', () => {
  it('vai e volta', () => {
    expect(lerReferencia(montarReferencia({ tipo: 'assinatura', empresaId: 'abc' }))).toEqual({ tipo: 'assinatura', empresaId: 'abc' });
    expect(lerReferencia(montarReferencia({ tipo: 'creditos', empresaId: 'abc', pacoteId: 'creditos-50' }))).toEqual({ tipo: 'creditos', empresaId: 'abc', pacoteId: 'creditos-50' });
    expect(lerReferencia('outra-coisa')).toBeNull();
    expect(lerReferencia('atena:assinatura:')).toBeNull();
  });
});

describe('assinatura e liberação', () => {
  it('teste grátis libera tudo sem cobrança', async () => {
    await iniciarTeste(d, 'emp1');
    expect((await lerAcesso(d, 'emp1')).fase).toBe('teste');
    expect(await repo.abasDaEmpresa('emp1')).toEqual(['atendimento', 'coach', 'estudio']);
  });

  it('assinar NÃO libera o plano; só o pagamento confirmado lido na API libera', async () => {
    await iniciarTeste(d, 'emp1');
    const r = await assinar(d, { empresaId: 'emp1', planoId: 'atendimento', pagador: PAGADOR });
    expect(r.faturaUrl).toBeTruthy();
    expect(r.assinatura.pagoAte).toBeUndefined();
    // 1º vencimento = fim do teste
    const p = await pagamentoAberto('emp1');
    expect(p.dueDate).toBe('2026-11-08');
    expect(p.value).toBe(297);

    // Pendente: processar não libera
    expect((await processarPagamento(d, p.id)).resultado).toBe('nada');
    expect((await repo.obterAssinatura('emp1'))!.pagoAte).toBeUndefined();

    asaas.definirStatus(p.id, 'CONFIRMED', T0);
    const res = await processarPagamento(d, p.id);
    expect(res.resultado).toBe('aplicado');
    const a = await repo.obterAssinatura('emp1');
    expect(a!.pagoAte!.slice(0, 10)).toBe('2026-12-09'); // 08/12 23:59 em SP = 09/12 02:59 UTC
    expect(a!.faturaAbertaUrl).toBeUndefined();
    expect(await repo.abasDaEmpresa('emp1')).toEqual(['atendimento']);
    const acesso = await lerAcesso(d, 'emp1');
    expect(acesso.fase).toBe('ativa');
    expect(acesso.abas).toEqual(['atendimento']);
  });

  it('webhook mentiroso não libera: o status vem da API, não do corpo', async () => {
    await assinar(d, { empresaId: 'emp1', planoId: 'atendimento', pagador: PAGADOR });
    const p = await pagamentoAberto('emp1');
    const r = await processarWebhook(d, { token: 'segredo', tokenEsperado: 'segredo', corpo: { event: 'PAYMENT_CONFIRMED', payment: { id: p.id, status: 'CONFIRMED' } } });
    expect(r.status).toBe(200);
    expect(r.resultado?.resultado).toBe('nada');
    expect((await repo.obterAssinatura('emp1'))!.pagoAte).toBeUndefined();
  });

  it('webhook sem token certo é recusado', async () => {
    expect((await processarWebhook(d, { token: 'errado', tokenEsperado: 'segredo', corpo: {} })).status).toBe(401);
    expect((await processarWebhook(d, { token: null, tokenEsperado: 'segredo', corpo: {} })).status).toBe(401);
    expect((await processarWebhook(d, { token: 'x', tokenEsperado: undefined, corpo: {} })).status).toBe(401);
    expect(tokenWebhookConfere('abc', 'abc')).toBe(true);
    expect(pagamentoIdDoWebhook({ payment: { id: 'pay_1' } })).toBe('pay_1');
    expect(pagamentoIdDoWebhook({ payment: { id: '../x' } })).toBeNull();
  });

  it('pagamento repetido (webhook duplicado) libera e credita uma vez só', async () => {
    await assinar(d, { empresaId: 'emp1', planoId: 'estudio', pagador: PAGADOR });
    const p = await pagamentoAberto('emp1');
    asaas.definirStatus(p.id, 'RECEIVED');
    const [r1, r2] = await Promise.all([processarPagamento(d, p.id), processarPagamento(d, p.id)]);
    expect([r1.resultado, r2.resultado].sort()).toEqual(['aplicado', 'nada']);
    expect(await repo.obterSaldo('emp1')).toBe(100);
    const pagoAte = (await repo.obterAssinatura('emp1'))!.pagoAte;
    await processarPagamento(d, p.id);
    expect((await repo.obterAssinatura('emp1'))!.pagoAte).toBe(pagoAte);
    expect(await repo.obterSaldo('emp1')).toBe(100);
  });

  it('mensalidades seguidas estendem mês a mês', async () => {
    await assinar(d, { empresaId: 'emp1', planoId: 'atendimento', pagador: PAGADOR });
    const p1 = await pagamentoAberto('emp1');
    asaas.definirStatus(p1.id, 'CONFIRMED');
    await processarPagamento(d, p1.id);
    const a = await repo.obterAssinatura('emp1');
    const p2 = asaas.gerarMensalidade(a!.asaasAssinaturaId!, '2026-12-08');
    asaas.definirStatus(p2.id, 'RECEIVED');
    await sincronizar(d, 'emp1');
    expect((await repo.obterAssinatura('emp1'))!.pagoAte!.slice(0, 10)).toBe('2027-01-09');
  });

  it('vencido sem pagar: aviso e depois só leitura', async () => {
    await assinar(d, { empresaId: 'emp1', planoId: 'atendimento', pagador: PAGADOR });
    const p1 = await pagamentoAberto('emp1');
    asaas.definirStatus(p1.id, 'CONFIRMED');
    await processarPagamento(d, p1.id);
    agora = '2026-12-10T12:00:00.000Z';
    expect((await lerAcesso(d, 'emp1')).fase).toBe('carencia');
    agora = '2026-12-13T12:00:00.000Z';
    const s = await lerAcesso(d, 'emp1');
    expect(s.fase).toBe('somente_leitura');
    expect(s.podeEscrever).toBe(false);
  });

  it('anual libera 12 meses e 12x os créditos', async () => {
    await assinar(d, { empresaId: 'emp1', planoId: 'completo', ciclo: 'anual', vendedores: 5, pagador: PAGADOR });
    const p = await pagamentoAberto('emp1');
    expect(p.value).toBe(Math.round((44700 + 2 * 5900) * 12 * 0.85) / 100);
    asaas.definirStatus(p.id, 'CONFIRMED');
    await processarPagamento(d, p.id);
    expect((await repo.obterAssinatura('emp1'))!.pagoAte!.slice(0, 7)).toBe('2027-11');
    expect(await repo.obterSaldo('emp1')).toBe(150 * 12);
  });

  it('estorno volta o acesso e tira os créditos', async () => {
    await assinar(d, { empresaId: 'emp1', planoId: 'estudio', pagador: PAGADOR });
    const p = await pagamentoAberto('emp1');
    asaas.definirStatus(p.id, 'CONFIRMED');
    await processarPagamento(d, p.id);
    asaas.definirStatus(p.id, 'REFUNDED');
    expect((await processarPagamento(d, p.id)).resultado).toBe('aplicado');
    expect((await repo.obterAssinatura('emp1'))!.pagoAte).toBeUndefined();
    expect(await repo.obterSaldo('emp1')).toBe(0);
    expect((await processarPagamento(d, p.id)).resultado).toBe('nada');
  });

  it('CPF/CNPJ inválido não cria cliente', async () => {
    await expect(assinar(d, { empresaId: 'emp1', planoId: 'atendimento', pagador: { nome: 'X', cpfCnpj: '123' } })).rejects.toThrow(/inválido/);
  });

  it('cancelar: usa até o fim do pago', async () => {
    await assinar(d, { empresaId: 'emp1', planoId: 'atendimento', pagador: PAGADOR });
    const p = await pagamentoAberto('emp1');
    asaas.definirStatus(p.id, 'CONFIRMED');
    await processarPagamento(d, p.id);
    await cancelar(d, 'emp1');
    agora = '2026-12-05T12:00:00.000Z';
    expect((await lerAcesso(d, 'emp1')).fase).toBe('ativa');
    agora = '2026-12-10T12:00:00.000Z';
    expect((await lerAcesso(d, 'emp1')).fase).toBe('somente_leitura');
  });
});

describe('créditos avulsos', () => {
  it('compra de pacote só credita depois de pago', async () => {
    await iniciarTeste(d, 'emp1');
    const c = await comprarCreditos(d, 'emp1', 'creditos-150', PAGADOR);
    expect(await repo.obterSaldo('emp1')).toBe(0);
    asaas.definirStatus(c.pagamentoId, 'RECEIVED');
    await processarPagamento(d, c.pagamentoId);
    expect(await repo.obterSaldo('emp1')).toBe(150);
    expect((await repo.extrato('emp1'))[0]).toMatchObject({ origem: 'pacote', quantidade: 150, saldoDepois: 150 });
  });
  it('pacote inexistente', async () => {
    await iniciarTeste(d, 'emp1');
    await expect(comprarCreditos(d, 'emp1', 'creditos-9999', PAGADOR)).rejects.toThrow();
  });
});

describe('isolamento entre empresas', () => {
  it('pagamento com referência de outra empresa é recusado e vira alerta', async () => {
    await assinar(d, { empresaId: 'empA', planoId: 'atendimento', pagador: PAGADOR });
    await assinar(d, { empresaId: 'empB', planoId: 'atendimento', pagador: { ...PAGADOR, cpfCnpj: '529.982.247-25' } });
    const aA = await repo.obterAssinatura('empA');
    // Cobrança feita no cliente Asaas da empresa A, mas com referência da empresa B
    const c = await asaas.criarCobranca({ customer: aA!.asaasClienteId!, billingType: 'PIX', value: 49, dueDate: '2026-11-01', externalReference: montarReferencia({ tipo: 'creditos', empresaId: 'empB', pacoteId: 'creditos-50' }) });
    asaas.definirStatus(c.id, 'RECEIVED');
    const r = await processarPagamento(d, c.id);
    expect(r.resultado).toBe('recusado');
    expect(await repo.obterSaldo('empB')).toBe(0);
    expect(await repo.obterSaldo('empA')).toBe(0);
    expect((await repo.alertas())[0].motivo).toMatch(/Cliente do Asaas/);
  });

  it('decidir recusa estado de outra empresa', () => {
    const dec = decidir(
      { id: 'pay_1', customer: 'cus_1', value: 297, status: 'CONFIRMED', dueDate: '2026-11-01', externalReference: 'atena:assinatura:empA' },
      { empresaId: 'empB', assinatura: null, saldoCreditos: 0, registro: null }, T0,
    );
    expect(dec.acao).toBe('recusar');
  });

  it('valor menor que o pacote é recusado', async () => {
    await iniciarTeste(d, 'emp1');
    await comprarCreditos(d, 'emp1', 'creditos-50', PAGADOR);
    const a = await repo.obterAssinatura('emp1');
    const c = await asaas.criarCobranca({ customer: a!.asaasClienteId!, billingType: 'PIX', value: 1, dueDate: '2026-11-01', externalReference: montarReferencia({ tipo: 'creditos', empresaId: 'emp1', pacoteId: 'creditos-400' }) });
    asaas.definirStatus(c.id, 'RECEIVED');
    expect((await processarPagamento(d, c.id)).resultado).toBe('recusado');
    expect(await repo.obterSaldo('emp1')).toBe(0);
  });
});
