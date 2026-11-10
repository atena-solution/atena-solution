import { describe, it, expect } from 'vitest';
import { extrairJson, normalizarAnalise, normalizarResultado, analiseSimulada, montarPromptAnalise } from '../../lib/coach/analise';
import { analisarComIA } from '../../lib/coach/ia';
import { modeloDeRoteiro } from '../../lib/coach/modelos';
import type { Fala } from '../../lib/coach/tipos';

const roteiro = modeloDeRoteiro('generico');
const falas: Fala[] = [
  { quem: 'vendedor', trilha: 'vendedor', inicioSeg: 0, fimSeg: 60, texto: 'Como você conheceu a gente? O que fez você procurar isso agora?' },
  { quem: 'cliente', trilha: 'cliente', inicioSeg: 60, fimSeg: 80, texto: 'Achei caro, vou pensar.' },
];
const ctx = { roteiro, falas, agoraISO: '2026-11-01T12:00:00.000Z' };

describe('extrairJson', () => {
  it('aceita cerca de código e texto em volta', () => {
    expect(extrairJson('Claro! ```json\n{"a":1}\n``` pronto')).toEqual({ a: 1 });
    expect(extrairJson('aqui: {"a":[1,2,],}')).toEqual({ a: [1, 2] });
  });
  it('lixo vira null', () => {
    expect(extrairJson('não sei')).toBeNull();
    expect(extrairJson('{quebrado')).toBeNull();
    expect(extrairJson('')).toBeNull();
  });
});

describe('normalizarResultado', () => {
  it.each([
    ['Fechou', 'fechou'], ['VENDA', 'fechou'], ['sem interesse', 'sem_interesse'], ['perdido', 'sem_interesse'],
    ['Vai pensar', 'pensando'], ['retorno', 'retorno'], ['???', 'retorno'], [undefined, 'retorno'],
  ])('%s → %s', (e, s) => expect(normalizarResultado(e)).toBe(s));
});

describe('normalizarAnalise', () => {
  it('JSON vazio/lixo não quebra e segue o roteiro', () => {
    const a = normalizarAnalise('resposta inválida', ctx);
    expect(a.etapas.map((e) => e.etapaId)).toEqual(roteiro.etapas.map((e) => e.id));
    expect(a.etapas.every((e) => e.status === 'nao_feita')).toBe(true);
    expect(a.nota).toBe(0);
    expect(a.resultado).toBe('retorno');
    expect(a.fala).toEqual({ vendedorPct: 75, clientePct: 25 });
  });
  it('limita números, corrige formatos e casa etapa pelo nome', () => {
    const a = normalizarAnalise({
      nota: '12', chanceFechar: '0.7', resultado: 'pensando',
      etapas: [{ nome: 'Diagnóstico', status: 'Parcial' }, { etapaId: 'conexao', status: 'sim' }, { etapaId: 'inventada', status: 'feita' }],
      objecoes: [{ objecao: 'Caro', momento: '01:00', bemRespondida: 'não' }, { objecao: '' }],
      pontosFortes: '- ouviu bem\n- fez perguntas',
      proximoPasso: { acao: 'Ligar', data: '05/11/2026' },
      diagnostico: { dores: 'perde cliente' },
    }, ctx);
    expect(a.nota).toBe(10);
    expect(a.chanceFechar).toBe(70);
    expect(a.etapas.find((e) => e.etapaId === 'diagnostico')!.status).toBe('parcial');
    expect(a.etapas.find((e) => e.etapaId === 'conexao')!.status).toBe('feita');
    expect(a.etapas).toHaveLength(roteiro.etapas.length);
    expect(a.objecoes).toEqual([{ objecao: 'Caro', momentoSeg: 60, bemRespondida: false, comoRespondeu: '', comoResponderMelhor: '' }]);
    expect(a.pontosFortes).toEqual(['ouviu bem', 'fez perguntas']);
    expect(a.proximoPasso).toEqual({ acao: 'Ligar', data: '2026-11-05' });
    expect(a.diagnostico.dores).toEqual(['perde cliente']);
  });
  it('fechou = chance 100', () => {
    expect(normalizarAnalise({ resultado: 'fechou', chanceFechar: 40 }, ctx).chanceFechar).toBe(100);
  });
  it('nota com uma casa', () => {
    expect(normalizarAnalise({ nota: 7.46 }, ctx).nota).toBe(7.5);
  });
});

describe('simulada e IA', () => {
  it('simulada é determinística e marca etapas pelo texto', () => {
    const a = analiseSimulada(ctx);
    expect(a.simulado).toBe(true);
    expect(a.resultado).toBe('pensando');
    expect(a.objecoes.some((o) => o.objecao === 'Está caro')).toBe(true);
    expect(analiseSimulada(ctx)).toEqual(a);
  });
  it('prompt tem roteiro, transcrição e data', () => {
    const p = montarPromptAnalise({ roteiro, falas, hojeISO: '2026-11-01' });
    expect(p).toContain('[00:00] Vendedor:');
    expect(p).toContain('2026-11-01');
    expect(p).toContain('diagnostico');
  });
  it('analisarComIA usa a chamada injetada e normaliza', async () => {
    let visto = '';
    const a = await analisarComIA({ roteiro, falas, agoraISO: ctx.agoraISO }, async (_s, p) => {
      visto = p;
      return '```json\n{"resumo":"ok","resultado":"fechou","nota":9}\n```';
    });
    expect(visto).toContain('TRANSCRIÇÃO');
    expect(a).toMatchObject({ resumo: 'ok', resultado: 'fechou', nota: 9 });
  });
  it('sem chave cai no simulado', async () => {
    const antes = process.env.SIMULAR;
    process.env.SIMULAR = '1';
    const a = await analisarComIA({ roteiro, falas });
    expect(a.simulado).toBe(true);
    process.env.SIMULAR = antes;
  });
});
