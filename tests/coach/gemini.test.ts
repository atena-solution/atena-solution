import { describe, it, expect, beforeEach } from 'vitest';
import { lerFalas, transcricaoSimulada, transcreverPedaco, transcreverArquivo, promptTranscricao } from '../../lib/integracoes/gemini';

beforeEach(() => { process.env.SIMULAR = '1'; });

describe('lerFalas', () => {
  it('força o falante pela trilha', () => {
    const r = lerFalas('{"falas":[{"quem":"cliente","inicioSeg":1,"fimSeg":2,"texto":"oi"}]}', 'vendedor');
    expect(r).toEqual([{ quem: 'vendedor', trilha: 'vendedor', inicioSeg: 1, fimSeg: 2, texto: 'oi' }]);
  });
  it('na trilha misto usa o quem da IA', () => {
    const r = lerFalas('```json\n[{"quem":"Cliente","inicioSeg":"00:05","fimSeg":"00:07","texto":"caro"},{"speaker":"x","start":1,"text":"hm"},]\n```', 'misto');
    expect(r.map((x) => [x.quem, x.inicioSeg])).toEqual([['desconhecido', 1], ['cliente', 5]]);
    expect(r[0].fimSeg).toBeGreaterThan(1);
  });
  it('lixo vira lista vazia', () => {
    expect(lerFalas('erro', 'cliente')).toEqual([]);
    expect(lerFalas('{"falas":[{"texto":""}]}', 'cliente')).toEqual([]);
  });
});

describe('simulado', () => {
  it('pedaço de trilha só tem aquele falante', async () => {
    const r = await transcreverPedaco(new Uint8Array([1]), 'audio/webm', { trilha: 'cliente', indice: 0, duracaoSeg: 300 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((f) => f.quem === 'cliente' && f.fimSeg <= 300)).toBe(true);
  });
  it('misto tem os dois', () => {
    const r = transcricaoSimulada({ trilha: 'misto', indice: 1 });
    expect(new Set(r.map((f) => f.quem))).toEqual(new Set(['vendedor', 'cliente']));
  });
  it('arquivo em janelas soma o início da janela', async () => {
    const avancos: number[] = [];
    const r = await transcreverArquivo(null, [{ inicioSeg: 0, fimSeg: 600 }, { inicioSeg: 600, fimSeg: 900 }], 'misto', undefined, (f) => { avancos.push(f); });
    expect(avancos).toEqual([1, 2]);
    expect(r.some((f) => f.inicioSeg >= 600)).toBe(true);
  });
  it('prompt da janela cita o trecho', () => {
    expect(promptTranscricao('misto', { inicioSeg: 600, fimSeg: 1200 })).toContain('10:00 até 20:00');
  });
});

describe('real (fetch falso)', () => {
  it('monta a chamada generateContent e lê a resposta', async () => {
    process.env.SIMULAR = '0';
    process.env.GEMINI_API_KEY = 'teste';
    let corpo: any = null;
    let url = '';
    const fetcher = (async (u: string, init: any) => {
      url = u; corpo = JSON.parse(init.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"falas":[{"quem":"vendedor","inicioSeg":0,"fimSeg":2,"texto":"bom dia"}]}' }] } }] }));
    }) as unknown as typeof fetch;
    const r = await transcreverPedaco(new Uint8Array([104, 105]), 'audio/webm;codecs=opus', { trilha: 'vendedor' }, fetcher);
    expect(url).toContain(':generateContent');
    expect(corpo.contents[0].parts[0].inline_data).toEqual({ mime_type: 'audio/webm', data: 'aGk=' });
    expect(corpo.generationConfig.responseMimeType).toBe('application/json');
    expect(r[0].texto).toBe('bom dia');
    delete process.env.GEMINI_API_KEY;
  });
});
