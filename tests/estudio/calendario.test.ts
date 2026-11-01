import { describe, expect, it } from 'vitest';
import { blackFriday, datasDoMes, mudarStatusPauta, nesimoDomingo, pascoa, sugerirMes } from '../../lib/estudio/calendario';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

describe('datas móveis', () => {
  it('Páscoa', () => {
    expect(ymd(pascoa(2026))).toBe('2026-04-05');
    expect(ymd(pascoa(2027))).toBe('2027-03-28');
  });
  it('Dia das Mães e dos Pais', () => {
    expect(ymd(nesimoDomingo(2026, 5, 2))).toBe('2026-05-10');
    expect(ymd(nesimoDomingo(2026, 8, 2))).toBe('2026-08-09');
  });
  it('Black Friday', () => {
    expect(ymd(blackFriday(2026))).toBe('2026-11-27');
    expect(ymd(blackFriday(2027))).toBe('2027-11-26');
  });
  it('Carnaval 2027 cai em fevereiro', () => {
    expect(datasDoMes(2027, 2, 'barbearia').map((d) => d.nome)).toContain('Carnaval');
  });
});

describe('datas por segmento', () => {
  it('Novembro Azul para barbearia, não para imobiliária', () => {
    expect(datasDoMes(2026, 11, 'barbearia').map((d) => d.nome)).toContain('Novembro Azul');
    expect(datasDoMes(2026, 11, 'imobiliaria').map((d) => d.nome)).not.toContain('Novembro Azul');
  });
});

describe('sugestão do mês', () => {
  const pautas = sugerirMes({ ano: 2026, mes: 11, segmento: 'barbearia', empresaId: 'e1' });
  it('tudo no mês certo, ordenado, como rascunho e da empresa', () => {
    expect(pautas.length).toBeGreaterThan(8);
    for (const p of pautas) {
      expect(p.data.startsWith('2026-11-')).toBe(true);
      expect(p.status).toBe('rascunho');
      expect(p.empresaId).toBe('e1');
    }
    expect([...pautas].map((p) => p.data).sort()).toEqual(pautas.map((p) => p.data));
    expect(new Set(pautas.map((p) => p.id)).size).toBe(pautas.length);
  });
  it('inclui Black Friday antes da data', () => {
    const bf = pautas.find((p) => p.tema.startsWith('Black Friday'));
    expect(bf?.data).toBe('2026-11-25');
    expect(bf?.modelo).toBe('promocao');
  });
});

describe('status da pauta', () => {
  const p = sugerirMes({ ano: 2026, mes: 12, segmento: 'loja', empresaId: 'e1' })[0];
  it('rascunho → arte-gerada exige criação', () => {
    expect(() => mudarStatusPauta(p, 'arte-gerada', 'agora')).toThrow();
    const a = mudarStatusPauta(p, 'arte-gerada', 'agora', 'c1');
    expect(a.criacaoId).toBe('c1');
    const pub = mudarStatusPauta(a, 'publicado', '2026-12-02T10:00:00Z');
    expect(pub.publicadoEm).toBe('2026-12-02T10:00:00Z');
    const volta = mudarStatusPauta(pub, 'arte-gerada', 'x');
    expect(volta.publicadoEm).toBeUndefined();
  });
  it('publicado não volta direto a rascunho', () => {
    const pub = mudarStatusPauta(p, 'publicado', 'x');
    expect(() => mudarStatusPauta(pub, 'rascunho', 'x')).toThrow();
  });
});
