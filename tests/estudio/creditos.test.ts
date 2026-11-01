import { describe, expect, it } from 'vitest';
import { custoDe, debitar, devolver, resumoExtrato, valorDevolucaoParcial, CUSTO_CREDITOS } from '../../lib/estudio/creditos';
import type { LancamentoCredito } from '../../lib/estudio/tipos';

const ctx = { empresaId: 'e1', id: 'l1', quando: '2026-11-01T10:00:00Z', criacaoId: 'c1' };

describe('créditos', () => {
  it('custo por tipo e quantidade', () => {
    expect(custoDe('foto', 3)).toBe(CUSTO_CREDITOS.foto * 3);
    expect(custoDe('slideshow')).toBe(0);
    expect(() => custoDe('foto', 0)).toThrow();
    expect(() => custoDe('foto', 99)).toThrow();
    expect(() => custoDe('foto', 1.5)).toThrow();
  });

  it('debita antes de gerar e grava lançamento', () => {
    const r = debitar(10, 4, 'Foto', ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.saldo).toBe(6);
      expect(r.lancamento).toMatchObject({ tipo: 'debito', valor: 4, saldoDepois: 6, criacaoId: 'c1' });
    }
  });

  it('não deixa saldo negativo', () => {
    const r = debitar(3, 4, 'Foto', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.saldo).toBe(3);
      expect(r.falta).toBe(1);
      expect(r.mensagem).toContain('Falta');
    }
  });

  it('custo zero não gera lançamento', () => {
    const r = debitar(0, 0, 'Slideshow', ctx);
    expect(r).toEqual({ ok: true, saldo: 0, lancamento: null });
  });

  it('valores inválidos dão erro', () => {
    expect(() => debitar(10, -1, 'x', ctx)).toThrow();
    expect(() => debitar(NaN, 1, 'x', ctx)).toThrow();
  });

  it('devolve só o que foi debitado e uma vez só', () => {
    const d = debitar(10, 6, 'Foto', ctx);
    if (!d.ok || !d.lancamento) throw new Error('esperava débito');
    const extrato: LancamentoCredito[] = [d.lancamento];
    const r1 = devolver(d.saldo, extrato, 'c1', 100, 'falhou', { ...ctx, id: 'l2' });
    expect(r1.saldo).toBe(10);
    expect(r1.lancamento?.valor).toBe(6);
    extrato.push(r1.lancamento!);
    const r2 = devolver(r1.saldo, extrato, 'c1', 6, 'de novo', { ...ctx, id: 'l3' });
    expect(r2.lancamento).toBeNull();
    expect(r2.saldo).toBe(10);
  });

  it('não devolve débito de outra empresa', () => {
    const d = debitar(10, 6, 'Foto', { ...ctx, empresaId: 'outra' });
    if (!d.ok || !d.lancamento) throw new Error();
    const r = devolver(50, [d.lancamento], 'c1', 6, 'x', { ...ctx, id: 'l2' });
    expect(r.lancamento).toBeNull();
  });

  it('devolução parcial pelas variações que faltaram', () => {
    expect(valorDevolucaoParcial('foto', 4, 3)).toBe(CUSTO_CREDITOS.foto);
    expect(valorDevolucaoParcial('foto', 4, 4)).toBe(0);
    expect(valorDevolucaoParcial('foto', 4, 0)).toBe(CUSTO_CREDITOS.foto * 4);
  });

  it('extrato resume gasto líquido só da empresa', () => {
    const ls: LancamentoCredito[] = [
      { id: '1', empresaId: 'e1', tipo: 'recarga', valor: 50, saldoDepois: 50, motivo: 'r', quando: '2026-11-01T01:00:00Z' },
      { id: '2', empresaId: 'e1', tipo: 'debito', valor: 8, saldoDepois: 42, motivo: 'f', quando: '2026-11-01T02:00:00Z', criacaoId: 'a' },
      { id: '3', empresaId: 'e1', tipo: 'devolucao', valor: 2, saldoDepois: 44, motivo: 'd', quando: '2026-11-01T03:00:00Z', criacaoId: 'a' },
      { id: '4', empresaId: 'e2', tipo: 'debito', valor: 99, saldoDepois: 0, motivo: 'x', quando: '2026-11-01T04:00:00Z' },
    ];
    const r = resumoExtrato(ls, 'e1');
    expect(r.gasto).toBe(6);
    expect(r.recarregado).toBe(50);
    expect(r.lancamentos.map((l) => l.id)).toEqual(['3', '2', '1']);
  });
});
