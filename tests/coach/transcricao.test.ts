import { describe, it, expect } from 'vitest';
import { deslocarFalas, juntarTrilhas, porcentagemFala, falaNoTempo, formatarTempo, transcricaoParaTexto, duracaoTotal } from '../../lib/coach/transcricao';
import type { Fala, Pedaco } from '../../lib/coach/tipos';

const f = (quem: Fala['quem'], ini: number, fim: number, texto = 'x', trilha: Fala['trilha'] = quem === 'desconhecido' ? 'misto' : quem): Fala => ({ quem, trilha, inicioSeg: ini, fimSeg: fim, texto });
const ped = (trilha: Pedaco['trilha'], indice: number, falas: Fala[], status: Pedaco['status'] = 'transcrito'): Pedaco => ({ trilha, indice, inicioSeg: indice * 300, duracaoSeg: 300, status, falas });

describe('deslocarFalas', () => {
  it('soma o início do pedaço', () => {
    expect(deslocarFalas([f('vendedor', 2, 5)], 300)[0]).toMatchObject({ inicioSeg: 302, fimSeg: 305 });
  });
  it('corrige fim antes do início', () => {
    expect(deslocarFalas([f('cliente', 10, 4)], 0)[0].fimSeg).toBe(10);
  });
});

describe('juntarTrilhas', () => {
  it('intercala vendedor e cliente pelo tempo', () => {
    const r = juntarTrilhas([
      ped('vendedor', 0, [f('vendedor', 0, 3, 'oi'), f('vendedor', 10, 12, 'e aí?')]),
      ped('cliente', 0, [f('cliente', 4, 8, 'olá')]),
    ]);
    expect(r.map((x) => x.texto)).toEqual(['oi', 'olá', 'e aí?']);
  });
  it('funde falas seguidas da mesma pessoa com intervalo curto', () => {
    const r = juntarTrilhas([ped('vendedor', 0, [f('vendedor', 0, 3, 'a'), f('vendedor', 4, 6, 'b'), f('vendedor', 20, 22, 'c')])]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ texto: 'a b', inicioSeg: 0, fimSeg: 6 });
  });
  it('ignora pedaço com erro e fala vazia', () => {
    const r = juntarTrilhas([ped('vendedor', 0, [f('vendedor', 0, 1, '  ')]), ped('cliente', 1, [f('cliente', 300, 301)], 'erro')]);
    expect(r).toEqual([]);
  });
  it('empate no início: vendedor primeiro', () => {
    const r = juntarTrilhas([ped('cliente', 0, [f('cliente', 5, 6, 'c')]), ped('vendedor', 0, [f('vendedor', 5, 6, 'v')])]);
    expect(r.map((x) => x.quem)).toEqual(['vendedor', 'cliente']);
  });
  it('não altera os pedaços originais', () => {
    const p = [ped('vendedor', 0, [f('vendedor', 0, 3, 'a'), f('vendedor', 4, 6, 'b')])];
    juntarTrilhas(p);
    expect(p[0].falas[0].texto).toBe('a');
  });
});

describe('porcentagemFala', () => {
  it('calcula pelo tempo e soma 100', () => {
    expect(porcentagemFala([f('vendedor', 0, 30), f('cliente', 30, 40)])).toEqual({ vendedorPct: 75, clientePct: 25 });
  });
  it('sem falas = 0/0', () => {
    expect(porcentagemFala([])).toEqual({ vendedorPct: 0, clientePct: 0 });
  });
  it('ignora desconhecido', () => {
    expect(porcentagemFala([f('vendedor', 0, 10), f('desconhecido', 10, 100)])).toEqual({ vendedorPct: 100, clientePct: 0 });
  });
  it('arredonda e fecha 100', () => {
    const r = porcentagemFala([f('vendedor', 0, 1), f('cliente', 0, 2)]);
    expect(r.vendedorPct + r.clientePct).toBe(100);
  });
});

describe('player', () => {
  const falas = [f('vendedor', 0, 3), f('cliente', 5, 8), f('vendedor', 9, 12)];
  it('acha a fala no tempo', () => {
    expect(falaNoTempo(falas, -1)).toBe(-1);
    expect(falaNoTempo(falas, 0)).toBe(0);
    expect(falaNoTempo(falas, 6)).toBe(1);
    expect(falaNoTempo(falas, 4)).toBe(0);
    expect(falaNoTempo(falas, 100)).toBe(2);
  });
  it('formata tempo', () => {
    expect(formatarTempo(65)).toBe('01:05');
    expect(formatarTempo(3725)).toBe('1:02:05');
  });
  it('texto pro prompt', () => {
    expect(transcricaoParaTexto([f('cliente', 61, 62, 'caro')])).toBe('[01:01] Cliente: caro');
  });
  it('duração total', () => {
    expect(duracaoTotal([ped('vendedor', 0, []), { ...ped('cliente', 1, []), duracaoSeg: 120 }])).toBe(420);
  });
});
