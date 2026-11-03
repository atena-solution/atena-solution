import { describe, expect, it } from 'vitest';
import { CONFIG_PLANOS } from '../lib/planos/config';
import { calcularPreco, economiaDoPacote, formatarReais, normalizarVendedores, exigirPlano, tabelaComparacao } from '../lib/planos/preco';
import { novaAssinaturaDeTeste, podeUsarAba, situacaoAcesso, abasLiberadas, type Assinatura } from '../lib/planos/acesso';
import { somarMeses, fimDoDiaSP, dataSP } from '../lib/planos/datas';
import { aplicarMovimento, temCreditos } from '../lib/planos/creditos';

const T0 = '2026-11-01T12:00:00.000Z';
const dia = (n: number) => new Date(new Date(T0).getTime() + n * 86400000).toISOString();

describe('preço', () => {
  it('mensal simples', () => {
    const o = calcularPreco({ planoId: 'atendimento' });
    expect(o.valorCobrado).toBe(29700);
    expect(o.vendedores).toBe(0);
  });
  it('coach cobra por vendedor além dos inclusos', () => {
    expect(calcularPreco({ planoId: 'coach', vendedores: 1 }).mensalTotal).toBe(9700);
    expect(calcularPreco({ planoId: 'coach', vendedores: 4 }).mensalTotal).toBe(9700 + 3 * 9700);
  });
  it('vendedores nunca abaixo dos inclusos nem acima do máximo', () => {
    const c = exigirPlano('completo');
    expect(normalizarVendedores(c, 0)).toBe(3);
    expect(normalizarVendedores(c, -5)).toBe(3);
    expect(normalizarVendedores(c, 99999)).toBe(CONFIG_PLANOS.maxVendedores);
    expect(normalizarVendedores(exigirPlano('estudio'), 10)).toBe(0);
  });
  it('anual aplica desconto e mostra economia', () => {
    const o = calcularPreco({ planoId: 'atendimento', ciclo: 'anual' });
    expect(o.valorCobrado).toBe(Math.round(29700 * 12 * 0.85));
    expect(o.economiaAnual).toBe(29700 * 12 - o.valorCobrado);
  });
  it('anual vira mensal se o desconto estiver desligado', () => {
    const cfg = { ...CONFIG_PLANOS, descontoAnualPct: 0 };
    expect(calcularPreco({ planoId: 'atendimento', ciclo: 'anual' }, cfg).ciclo).toBe('mensal');
  });
  it('pacote completo sai mais barato que as 3 abas separadas', () => {
    expect(economiaDoPacote()).toBeGreaterThan(0);
  });
  it('plano desconhecido dá erro', () => {
    expect(() => calcularPreco({ planoId: 'xpto' })).toThrow();
  });
  it('formata reais', () => {
    expect(formatarReais(29700)).toBe('R$ 297,00');
    expect(formatarReais(29700, { semCentavosQuandoInteiro: true })).toBe('R$ 297');
    expect(formatarReais(123456)).toBe('R$ 1.234,56');
  });
  it('tabela de comparação tem todos os planos em cada linha', () => {
    for (const l of tabelaComparacao()) expect(Object.keys(l.valores).sort()).toEqual(['atendimento', 'coach', 'completo', 'estudio']);
  });
});

describe('datas', () => {
  it('somar meses respeita fim de mês', () => {
    expect(somarMeses('2026-01-31T10:00:00.000Z', 1).slice(0, 10)).toBe('2026-02-28');
    expect(somarMeses('2026-12-15T10:00:00.000Z', 1).slice(0, 10)).toBe('2027-01-15');
  });
  it('fim do dia em São Paulo', () => {
    expect(fimDoDiaSP('2026-11-08')).toBe('2026-11-09T02:59:59.999Z');
    expect(dataSP('2026-11-09T02:00:00.000Z')).toBe('2026-11-08');
  });
});

describe('acesso por aba', () => {
  const teste = novaAssinaturaDeTeste('emp1', T0);

  it('sem assinatura: nada liberado', () => {
    expect(situacaoAcesso(null, T0).fase).toBe('sem_plano');
    expect(podeUsarAba(null, 'atendimento', 'ler', T0)).toMatchObject({ permitido: false, motivo: 'sem_plano' });
  });
  it('teste grátis de 7 dias libera todas as abas', () => {
    expect(teste.testeAte).toBe(dia(7));
    const s = situacaoAcesso(teste, dia(3));
    expect(s.fase).toBe('teste');
    expect(s.abas).toEqual(['atendimento', 'coach', 'estudio']);
    expect(s.diasRestantes).toBe(4);
    expect(podeUsarAba(teste, 'estudio', 'escrever', dia(3)).permitido).toBe(true);
  });
  it('aviso fica mais forte no fim do teste', () => {
    expect(situacaoAcesso(teste, dia(6.5)).aviso?.tom).toBe('atencao');
  });
  it('teste vencido: carência de 3 dias, depois só leitura', () => {
    expect(situacaoAcesso(teste, dia(8)).fase).toBe('carencia');
    expect(podeUsarAba(teste, 'atendimento', 'escrever', dia(8)).permitido).toBe(true);
    const s = situacaoAcesso(teste, dia(10.5));
    expect(s.fase).toBe('somente_leitura');
    expect(podeUsarAba(teste, 'atendimento', 'escrever', dia(10.5))).toMatchObject({ permitido: false, motivo: 'somente_leitura' });
    expect(podeUsarAba(teste, 'atendimento', 'ler', dia(10.5)).permitido).toBe(true);
  });
  it('plano pago só libera as abas do plano', () => {
    const a: Assinatura = { ...teste, planoId: 'atendimento', pagoAte: dia(37) };
    expect(situacaoAcesso(a, dia(2)).fase).toBe('ativa'); // pagou durante o teste: vale o plano pago
    expect(podeUsarAba(a, 'atendimento', 'escrever', dia(20)).permitido).toBe(true);
    expect(podeUsarAba(a, 'coach', 'ler', dia(20))).toMatchObject({ permitido: false, motivo: 'aba_fora_do_plano' });
    expect(abasLiberadas(a, dia(20))).toEqual(['atendimento']);
  });
  it('cancelada: usa até o fim do pago, sem carência', () => {
    const a: Assinatura = { ...teste, planoId: 'coach', pagoAte: dia(30), canceladaEm: dia(10) };
    expect(situacaoAcesso(a, dia(29)).fase).toBe('ativa');
    expect(situacaoAcesso(a, dia(29)).aviso?.texto).toMatch(/cancelada/i);
    expect(situacaoAcesso(a, dia(31)).fase).toBe('somente_leitura');
  });
});

describe('créditos', () => {
  it('entra e não aplica duas vezes o mesmo id', () => {
    const r = aplicarMovimento(10, new Set(), { id: 'p1', empresaId: 'e', origem: 'pacote', quantidade: 50, descricao: '', quando: T0 });
    expect(r.saldo).toBe(60);
    expect(aplicarMovimento(60, new Set(['p1']), { id: 'p1', empresaId: 'e', origem: 'pacote', quantidade: 50, descricao: '', quando: T0 })).toEqual({ saldo: 60, movimento: null });
  });
  it('estorno não deixa saldo negativo', () => {
    const r = aplicarMovimento(20, new Set(), { id: 'x', empresaId: 'e', origem: 'estorno', quantidade: -50, descricao: '', quando: T0 });
    expect(r.saldo).toBe(0);
    expect(r.movimento?.quantidade).toBe(-20);
  });
  it('rejeita fração', () => {
    expect(() => aplicarMovimento(0, new Set(), { id: 'x', empresaId: 'e', origem: 'pacote', quantidade: 1.5, descricao: '', quando: T0 })).toThrow();
  });
  it('tem créditos', () => {
    expect(temCreditos(5, 5)).toBe(true);
    expect(temCreditos(4, 5)).toBe(false);
  });
});
