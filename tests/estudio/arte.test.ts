import { describe, expect, it } from 'vitest';
import { ajustarTexto, contraste, corMedia, escolherCorTexto, montarLayout, quebrarLinhas, CONTRASTE_MINIMO, type Medidor } from '../../lib/estudio/arte';
import { KIT_PADRAO } from '../../lib/estudio/marca';

// Medidor monoespaçado: cada caractere = 0,5 × tamanho.
const mono: Medidor = (t, s) => t.length * s * 0.5;

describe('quebra de linha', () => {
  it('quebra por palavras sem passar da largura', () => {
    const linhas = quebrarLinhas('Promoção de verão com até trinta por cento', 100, 10, mono); // 20 chars/linha
    expect(linhas).toEqual(['Promoção de verão', 'com até trinta por', 'cento']);
    for (const l of linhas) expect(mono(l, 10)).toBeLessThanOrEqual(100);
  });
  it('parte palavra gigante com hífen', () => {
    const linhas = quebrarLinhas('Supercalifragilisticexpialidocious', 50, 10, mono); // 10 chars
    for (const l of linhas) expect(mono(l, 10)).toBeLessThanOrEqual(50);
    expect(linhas[0].endsWith('-')).toBe(true);
    expect(linhas.join('').replace(/-/g, '')).toBe('Supercalifragilisticexpialidocious');
  });
  it('respeita quebra manual', () => {
    expect(quebrarLinhas('Linha um\nLinha dois', 1000, 10, mono)).toEqual(['Linha um', 'Linha dois']);
  });
  it('texto vazio dá zero linhas', () => {
    expect(quebrarLinhas('   ', 100, 10, mono)).toEqual([]);
  });
});

describe('ajuste do tamanho', () => {
  it('usa a maior fonte que cabe', () => {
    const a = ajustarTexto('Oi', { largura: 1000, altura: 1000 }, { max: 100, min: 20, maxLinhas: 2 }, mono);
    expect(a.tamanho).toBe(100);
    expect(a.cortado).toBe(false);
  });
  it('diminui para caber em maxLinhas', () => {
    const a = ajustarTexto('palavra palavra palavra palavra', { largura: 400, altura: 1000 }, { max: 100, min: 20, maxLinhas: 2 }, mono);
    expect(a.linhas.length).toBeLessThanOrEqual(2);
    expect(a.tamanho).toBeLessThan(100);
  });
  it('corta com reticências quando não cabe nem no mínimo', () => {
    const a = ajustarTexto('um texto muito comprido '.repeat(20), { largura: 200, altura: 60 }, { max: 40, min: 20, maxLinhas: 2 }, mono);
    expect(a.cortado).toBe(true);
    expect(a.linhas.length).toBeLessThanOrEqual(2);
    expect(a.linhas.at(-1)!.endsWith('…')).toBe(true);
    for (const l of a.linhas) expect(mono(l, a.tamanho)).toBeLessThanOrEqual(200);
  });
});

describe('contraste', () => {
  it('preto e branco = 21', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });
  it('escolhe texto escuro em fundo claro e claro em fundo escuro', () => {
    expect(escolherCorTexto('#F7F5F0').cor).toBe('#0E1116');
    expect(escolherCorTexto('#0E1116').cor).toBe('#FFFFFF');
  });
  it('se nenhuma cor serve, pede véu e garante AA', () => {
    const r = escolherCorTexto('#808080', ['#FFFFFF', '#000000'], 7);
    expect(r.veu).not.toBeNull();
    expect(r.contraste).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
  });
  it('cor média de pixels', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]);
    expect(corMedia(px, 1)).toBe('#800080');
  });
});

describe('layout da arte', () => {
  const marca = { ...KIT_PADRAO, logoUrl: 'logo.png' };
  it('promoção: fundo, selo, título, CTA e logo, tudo dentro da arte', () => {
    const l = montarLayout({ modelo: 'promocao', formato: '4:5', marca, textos: { titulo: 'Black Friday da Topetes', subtitulo: 'Corte + barba com 20% off', chamada: 'Agende já' }, fundo: 'fundo.png' });
    expect(l.largura).toBe(1080);
    expect(l.altura).toBe(1350);
    expect(l.camadas[0]).toMatchObject({ tipo: 'imagem', src: 'fundo.png' });
    const textos = l.camadas.filter((c) => c.tipo === 'texto');
    expect(textos.map((t) => (t.tipo === 'texto' ? t.linhas.join(' ') : ''))).toEqual(expect.arrayContaining(['PROMOÇÃO', 'Agende já']));
    for (const c of l.camadas) {
      if (c.tipo === 'texto') {
        const base = c.y + c.linhas.length * c.alturaLinha;
        expect(c.y).toBeGreaterThanOrEqual(0);
        expect(base).toBeLessThanOrEqual(l.altura);
      }
    }
    expect(l.camadas.some((c) => c.tipo === 'imagem' && c.src === 'logo.png')).toBe(true);
    expect(l.avisos).toEqual([]);
  });
  it('todo texto tem contraste AA com o que está atrás dele', () => {
    for (const fundo of ['#FFFFFF', '#0E1116', '#808080', '#E8A93B', '#3B5BDB']) {
      for (const modelo of ['promocao', 'novidade', 'depoimento'] as const) {
        const l = montarLayout({ modelo, formato: '4:5', marca, textos: { titulo: 'Título', subtitulo: 'Sub' }, fundo: 'f', corFundoTexto: fundo });
        const t = l.camadas.find((c) => c.tipo === 'texto' && c.linhas[0] === 'Título');
        const veu = l.camadas.find((c) => c.tipo === 'retangulo' && c.cor.startsWith('rgba') && !c.degrade);
        if (t?.tipo !== 'texto') throw new Error();
        const atras = veu?.tipo === 'retangulo' ? (veu.cor.startsWith('rgba(14') ? '#0E1116' : '#F7F5F0') : fundo;
        expect(contraste(t.cor, atras)).toBeGreaterThanOrEqual(3);
      }
    }
  });
  it('texto contrasta com o fundo informado', () => {
    const l = montarLayout({ modelo: 'novidade', formato: '1:1', marca, textos: { titulo: 'Chegou' }, fundo: 'f', corFundoTexto: '#FAFAFA' });
    const titulo = l.camadas.find((c) => c.tipo === 'texto' && c.linhas[0] === 'Chegou');
    expect(titulo && titulo.tipo === 'texto' && titulo.cor).toBe('#0E1116');
  });
  it('avisa quando o título é cortado', () => {
    const l = montarLayout({ modelo: 'novidade', formato: '1:1', marca, textos: { titulo: 'muito texto '.repeat(40) }, fundo: 'f' });
    expect(l.avisos.length).toBeGreaterThan(0);
  });
  it('antes/depois sem 2 fotos reais é bloqueado', () => {
    expect(() => montarLayout({ modelo: 'antes-depois', formato: '1:1', marca, textos: { titulo: 'x' }, fundo: '', fotosReais: ['a'] })).toThrow();
    const l = montarLayout({ modelo: 'antes-depois', formato: '1:1', marca, textos: { titulo: 'x' }, fundo: '', fotosReais: ['a', 'b'] });
    expect(l.camadas.filter((c) => c.tipo === 'imagem').map((c) => (c.tipo === 'imagem' ? c.rotulo : ''))).toEqual(expect.arrayContaining(['ANTES', 'DEPOIS']));
    // texto claro na faixa escura e abaixo das fotos
    const fotos = l.camadas.filter((c) => c.tipo === 'imagem');
    const baseFotos = Math.max(...fotos.map((c) => (c.tipo === 'imagem' ? c.y + c.altura : 0)));
    const titulo = l.camadas.find((c) => c.tipo === 'texto' && c.linhas[0] === 'x');
    expect(titulo?.tipo === 'texto' && titulo.cor).toBe('#FFFFFF');
    expect(titulo!.y).toBeGreaterThanOrEqual(baseFotos);
  });
});
