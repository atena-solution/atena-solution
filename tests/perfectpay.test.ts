import { beforeEach, describe, expect, it } from 'vitest';
import { criarAsaasSimulado } from '../lib/cobranca/asaas';
import { criarRepositorioMemoria, type RepositorioCobranca } from '../lib/cobranca/repositorio';
import { assinar, comprarCreditos, iniciarTeste, lerAcesso, processarVendaPP, sincronizarPP, type Deps } from '../lib/cobranca/servico';
import { codigoDoPlano, linkCheckout, postbackValido, statusDaVenda, type ClientePP, type VendaPP } from '../lib/cobranca/perfectpay';

const T0 = '2026-11-04T12:00:00.000Z';
let repo: RepositorioCobranca;
let vendas: VendaPP[];
let d: Deps;
let agora: string;
const mapa = new Map<string, string>();

const pp: ClientePP = {
  async buscarVenda(code) { return vendas.find((v) => v.transaction_token === code) ?? null; },
  async vendasDoEmail(email) { return vendas.filter((v) => (v.customer as { email: string }[])[0].email === email); },
};
const venda = (code: string, plano: string, valor: string, src: string | null, email = 'dono@a.com', status = 'approved'): VendaPP =>
  ({ transaction_token: code, sale_status: status, value: valor, plan: [{ plan_code: plano }], customer: [{ email }], metadata: src ? { src } : {} });

beforeEach(() => {
  repo = criarRepositorioMemoria();
  vendas = [];
  mapa.clear();
  agora = T0;
  d = {
    repo, asaas: criarAsaasSimulado(), pp, agora: () => agora,
    assinantes: { async obter(e) { return mapa.get(e) ?? null; }, async gravar(e, id) { mapa.set(e, id); } },
  };
});

describe('Perfect Pay', () => {
  it('checkout leva o pedido no src; postback só vale com o token da conta', () => {
    expect(codigoDoPlano('atendimento', 'mensal')).toBe('PPLQQQTPP');
    expect(codigoDoPlano('completo', 'anual')).toBe('PPLQQQTQ0');
    expect(linkCheckout('PPLQQQTPP', 'atena:assinatura:e1')).toBe('https://go.perfectpay.com.br/PPU38CQHGGU?src=atena%3Aassinatura%3Ae1');
    expect(postbackValido({ token: 'x' }, { PERFECTPAY_TOKEN: 'x' })).toBe(true);
    expect(postbackValido({ token: 'x' }, {})).toBe(false);
    expect(statusDaVenda({ sale_status: 'approved' })).toBe('RECEIVED');
    expect(statusDaVenda({ sale_status: 'refunded' })).toBe('REFUNDED');
    expect(statusDaVenda({ sale_status: 'pending' })).toBe('PENDING');
  });

  it('assinar devolve o link e não libera nada; a venda aprovada lida na API libera o plano comprado depois do teste', async () => {
    await iniciarTeste(d, 'e1');
    const r = await assinar(d, { empresaId: 'e1', planoId: 'atendimento', ciclo: 'mensal' });
    expect(r.faturaUrl).toContain('PPU38CQHGGU?src=atena%3Aassinatura%3Ae1');
    expect((await repo.obterAssinatura('e1'))!.pagoAte).toBeUndefined();

    vendas.push(venda('V1', 'PPLQQQTPP', '297.00', 'atena:assinatura:e1', 'dono@a.com', 'pending'));
    expect((await processarVendaPP(d, 'V1')).resultado).toBe('nada');

    vendas.push(venda('V2', 'PPLQQQTPP', '297.00', 'atena:assinatura:e1'));
    expect((await processarVendaPP(d, 'V2')).resultado).toBe('aplicado');
    const a = (await repo.obterAssinatura('e1'))!;
    expect(a.planoId).toBe('atendimento');
    expect(a.ppEmail).toBe('dono@a.com');
    expect(a.pagoAte! > a.testeAte!).toBe(true); // o período pago começa no fim do teste grátis
    expect(await repo.abasDaEmpresa('e1')).toEqual(['atendimento']);
    // repetido não soma de novo
    const ate = a.pagoAte;
    expect((await processarVendaPP(d, 'V2')).resultado).toBe('nada');
    expect((await repo.obterAssinatura('e1'))!.pagoAte).toBe(ate);
  });

  it('valor menor que o plano é recusado; plano anual libera 12 meses', async () => {
    await iniciarTeste(d, 'e1');
    vendas.push(venda('V3', 'PPLQQQTPT', '297.00', 'atena:assinatura:e1'));
    expect((await processarVendaPP(d, 'V3')).resultado).toBe('recusado');
    vendas.push(venda('V4', 'PPLQQQTPT', '3029.40', 'atena:assinatura:e1'));
    expect((await processarVendaPP(d, 'V4')).resultado).toBe('aplicado');
    const a = (await repo.obterAssinatura('e1'))!;
    expect(a.ciclo).toBe('anual');
    expect(new Date(a.pagoAte!).getTime() - new Date(a.testeAte!).getTime()).toBeGreaterThan(360 * 86400_000);
  });

  it('renovação sem src acha a empresa pelo e-mail do assinante e soma outro mês', async () => {
    await iniciarTeste(d, 'e1');
    vendas.push(venda('V5', 'PPLQQQTPQ', '97.00', 'atena:assinatura:e1'));
    await processarVendaPP(d, 'V5');
    const ate1 = (await repo.obterAssinatura('e1'))!.pagoAte!;
    vendas.push(venda('V6', 'PPLQQQTPQ', '97.00', null));
    expect((await processarVendaPP(d, 'V6')).resultado).toBe('aplicado');
    expect(new Date((await repo.obterAssinatura('e1'))!.pagoAte!).getTime() - new Date(ate1).getTime()).toBeGreaterThan(27 * 86400_000);
  });

  it('créditos entram uma vez; estorno tira o acesso de volta', async () => {
    await iniciarTeste(d, 'e1');
    const c = await comprarCreditos(d, 'e1', 'creditos-50');
    expect(c.faturaUrl).toContain('PPU38CQHGH8');
    const antes = await repo.obterSaldo('e1');
    vendas.push(venda('C1', 'PPLQQQTQ1', '49.00', 'atena:creditos:creditos-50:e1'));
    expect((await processarVendaPP(d, 'C1')).resultado).toBe('aplicado');
    expect(await repo.obterSaldo('e1')).toBe(antes + 50);
    expect((await processarVendaPP(d, 'C1')).resultado).toBe('nada');

    vendas.push(venda('V7', 'PPLQQQTPR', '97.00', 'atena:assinatura:e1'));
    await processarVendaPP(d, 'V7');
    vendas[vendas.length - 1] = venda('V7', 'PPLQQQTPR', '97.00', 'atena:assinatura:e1', 'dono@a.com', 'refunded');
    expect((await processarVendaPP(d, 'V7')).resultado).toBe('aplicado');
    expect((await repo.obterAssinatura('e1'))!.pagoAte).toBeUndefined();
  });

  it('"Já paguei" só aplica vendas desta empresa; vendedor extra não sai pelo checkout fixo', async () => {
    await iniciarTeste(d, 'e1');
    await iniciarTeste(d, 'e2');
    vendas.push(venda('X1', 'PPLQQQTPP', '297.00', 'atena:assinatura:e2', 'dono@a.com'));
    vendas.push(venda('X2', 'PPLQQQTPR', '97.00', 'atena:assinatura:e1', 'dono@a.com'));
    const r = await sincronizarPP(d, 'e1', 'dono@a.com');
    expect(r.filter((x) => x.resultado === 'aplicado')).toHaveLength(1);
    expect((await lerAcesso(d, 'e2')).fase).toBe('teste');
    await expect(assinar(d, { empresaId: 'e1', planoId: 'coach', vendedores: 3 })).rejects.toThrow(/vendedor/);
  });
});
