import { describe, expect, it } from 'vitest';
import { filtrarGaleria, nomeArquivo, contarPorTipo } from '../../lib/estudio/galeria';
import { criarRoteiro, quadroEm, escalaKenBurns } from '../../lib/estudio/slideshow';
import { lerRespostaLegenda, normalizarHashtag, legendaCompleta } from '../../lib/estudio/legenda';
import { kitDaEmpresa, normalizarHex, validarKit, KIT_PADRAO } from '../../lib/estudio/marca';
import { simularImagens, dividirDataUrl, consultarVideo } from '../../lib/integracoes/imagem';
import type { Criacao } from '../../lib/estudio/tipos';

const c = (x: Partial<Criacao>): Criacao => ({ id: 'x', empresaId: 'e1', tipo: 'foto', status: 'pronta', titulo: 'T', arquivos: [], creditos: 0, porUid: 'u', criadoEm: '2026-11-01T00:00:00Z', ...x });

describe('galeria', () => {
  const lista = [
    c({ id: '1', tipo: 'foto', titulo: 'Tênis branco', criadoEm: '2026-11-01T01:00:00Z', formato: '1:1' }),
    c({ id: '2', tipo: 'post', titulo: 'Promoção', legenda: 'Corte com desconto', hashtags: ['barbearia'], criadoEm: '2026-11-02T01:00:00Z' }),
    c({ id: '3', empresaId: 'e2', tipo: 'post', titulo: 'Promoção da outra' }),
  ];
  it('só mostra a empresa pedida, mais novo primeiro', () => {
    expect(filtrarGaleria(lista, 'e1').map((x) => x.id)).toEqual(['2', '1']);
  });
  it('filtra por tipo, formato e busca sem acento', () => {
    expect(filtrarGaleria(lista, 'e1', { tipo: 'post' }).map((x) => x.id)).toEqual(['2']);
    expect(filtrarGaleria(lista, 'e1', { formato: '1:1' }).map((x) => x.id)).toEqual(['1']);
    expect(filtrarGaleria(lista, 'e1', { busca: 'tenis' }).map((x) => x.id)).toEqual(['1']);
    expect(filtrarGaleria(lista, 'e1', { busca: 'BARBEARIA' }).map((x) => x.id)).toEqual(['2']);
  });
  it('nome de arquivo limpo', () => {
    expect(nomeArquivo(lista[0], 0)).toBe('atena-foto-tenis-branco-2026-11-01-1.png');
  });
  it('conta por tipo só da empresa', () => {
    expect(contarPorTipo(lista, 'e1')).toEqual({ foto: 1, post: 1 });
  });
});

describe('slideshow', () => {
  const r = criarRoteiro(4, 8);
  it('distribui o tempo entre as fotos', () => {
    expect(r.segundosPorFoto).toBe(2);
    expect(quadroEm(r, 0).indice).toBe(0);
    expect(quadroEm(r, 2.1).indice).toBe(1);
    expect(quadroEm(r, 99).indice).toBe(3);
    expect(quadroEm(r, 7.9).proxima).toBeNull();
  });
  it('transição só no fim de cada foto', () => {
    expect(quadroEm(r, 0.5).mistura).toBe(0);
    expect(quadroEm(r, 1.9).mistura).toBeGreaterThan(0);
    expect(quadroEm(r, 1.9).mistura).toBeLessThanOrEqual(1);
  });
  it('limites', () => {
    expect(() => criarRoteiro(0)).toThrow();
    expect(() => criarRoteiro(3, 60)).toThrow();
    expect(escalaKenBurns(0)).toBe(1);
    expect(escalaKenBurns(1)).toBeCloseTo(1.08);
  });
});

describe('legenda da IA', () => {
  it('lê JSON mesmo com texto em volta e normaliza hashtags', () => {
    const r = lerRespostaLegenda('Aqui está:\n{"titulo":"Corte novo","subtitulo":"s","chamada":"Agende","legenda":"L","hashtags":["#Barbearia","Corte Masculino","barbearia","São Paulo"]}');
    expect(r.titulo).toBe('Corte novo');
    expect(r.hashtags).toEqual(['barbearia', 'cortemasculino', 'saopaulo']);
    expect(legendaCompleta(r)).toBe('L\n\n#barbearia #cortemasculino #saopaulo');
  });
  it('limita o título a 40 caracteres', () => {
    expect(lerRespostaLegenda(JSON.stringify({ titulo: 'x'.repeat(80), legenda: '' })).titulo.length).toBe(40);
  });
  it('recusa formato inválido e palavras proibidas', () => {
    expect(() => lerRespostaLegenda('sem json')).toThrow();
    expect(() => lerRespostaLegenda('{"titulo":"A cura da calvície"}', ['cura'])).toThrow(/evita/);
  });
  it('normaliza hashtag', () => {
    expect(normalizarHashtag('##Pão de Açúcar!')).toBe('paodeacucar');
  });
});

describe('kit da marca', () => {
  it('vem do onboarding com padrão para o que faltar', () => {
    const k = kitDaEmpresa({ logoUrl: 'l.png', cores: { primaria: '#abc' }, tom: 'divertido' });
    expect(k.cores.primaria).toBe('#AABBCC');
    expect(k.cores.secundaria).toBe(KIT_PADRAO.cores.secundaria);
    expect(k.tom).toBe('divertido');
    expect(k.logoUrl).toBe('l.png');
  });
  it('valida cores e fontes', () => {
    expect(normalizarHex('zzz')).toBeNull();
    const e = validarKit({ cores: { primaria: 'azul', secundaria: '#000' }, fontes: { titulo: 'Comic Sans', texto: 'Inter' }, tom: 'a' });
    expect(Object.keys(e).sort()).toEqual(['primaria', 'titulo', 'tom']);
  });
});

describe('integração de imagem (simulada)', () => {
  it('gera N imagens SVG com a foto de referência', () => {
    const ref = 'data:image/png;base64,AAAA';
    const r = simularImagens({ prompt: 'p', referencias: [ref], proporcao: '9:16', quantidade: 3 });
    expect(r.imagens).toHaveLength(3);
    expect(r.falhas).toBe(0);
    const svg = Buffer.from(dividirDataUrl(r.imagens[0]).base64, 'base64').toString();
    expect(svg).toContain('height="1920"');
    expect(svg).toContain(ref);
  });
  it('vídeo simulado fica pronto', async () => {
    const r = await consultarVideo('simulado/9:16/1');
    expect(r.pronto && r.url?.startsWith('data:image/svg+xml')).toBe(true);
  });
});

import { paraMovimento, deMovimento } from '../../lib/estudio/repositorio-firestore';
describe('extrato no formato da sessão E (MovimentoCredito)', () => {
  it('débito vira uso negativo e volta igual', () => {
    const l = { id: 'm1', empresaId: 'e1', tipo: 'debito' as const, valor: 6, saldoDepois: 4, motivo: 'Foto (3x)', criacaoId: 'c1', quando: 'q' };
    const m = paraMovimento(l);
    expect(m).toMatchObject({ origem: 'uso', quantidade: -6, referencia: 'c1' });
    expect(deMovimento(m)).toEqual(l);
  });
  it('recarga do plano aparece como recarga', () => {
    expect(deMovimento({ id: 'p', empresaId: 'e1', origem: 'plano_mensal', quantidade: 100, saldoDepois: 100, descricao: 'Plano', quando: 'q' }).tipo).toBe('recarga');
  });
});
