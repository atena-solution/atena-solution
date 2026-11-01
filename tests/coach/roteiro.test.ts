import { describe, it, expect } from 'vitest';
import { normalizarRoteiro, roteiroParaTexto, slug } from '../../lib/coach/roteiro';
import { modeloDeRoteiro, idDoSegmento, SEGMENTOS } from '../../lib/coach/modelos';

describe('modelos', () => {
  it('todo segmento tem modelo com 6 etapas', () => {
    for (const s of SEGMENTOS) expect(modeloDeRoteiro(s.id).etapas).toHaveLength(6);
  });
  it('reconhece segmento solto', () => {
    expect(idDoSegmento('Clínica odontológica')).toBe('clinica');
    expect(idDoSegmento('Barber shop')).toBe('barbearia');
    expect(idDoSegmento('venda de imóveis')).toBe('imobiliaria');
    expect(idDoSegmento(undefined)).toBe('generico');
  });
  it('clínica ganha objeções próprias', () => {
    expect(modeloDeRoteiro('clinica').objecoes.some((o) => o.id === 'convenio')).toBe(true);
  });
  it('modelo passa na normalização sem mudar ids', () => {
    const m = modeloDeRoteiro('agencia');
    const n = normalizarRoteiro(m);
    expect(n.ok && n.roteiro.etapas.map((e) => e.id)).toEqual(m.etapas.map((e) => e.id));
  });
});

describe('normalizarRoteiro', () => {
  it('exige ao menos uma etapa', () => {
    expect(normalizarRoteiro({ etapas: [] })).toEqual({ ok: false, erros: ['Coloque pelo menos uma etapa no roteiro.'] });
    expect(normalizarRoteiro(null).ok).toBe(false);
  });
  it('limpa, cria ids e evita repetidos', () => {
    const n = normalizarRoteiro({ etapas: [{ nome: ' Conexão ', perguntasChave: ['a', '', 3] }, { nome: 'Conexão' }, { nome: '' }], objecoes: [{ objecao: 'Tá caro', respostaIdeal: 'x' }, { objecao: '' }] });
    expect(n.ok).toBe(true);
    if (!n.ok) return;
    expect(n.roteiro.etapas.map((e) => e.id)).toEqual(['conexao', 'conexao-2']);
    expect(n.roteiro.etapas[0].perguntasChave).toEqual(['a']);
    expect(n.roteiro.objecoes).toHaveLength(1);
  });
  it('slug', () => expect(slug('Preço & Condições!')).toBe('preco-condicoes'));
  it('texto pro prompt tem ids', () => expect(roteiroParaTexto(modeloDeRoteiro('loja'))).toContain('[fechamento] Fechamento'));
});
