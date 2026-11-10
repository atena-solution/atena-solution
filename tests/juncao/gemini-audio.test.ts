import { describe, expect, it } from 'vitest';
import { AUDIO_CLIENTE_SIMULADO, segundosAproxAudio, transcreverAudioCliente } from '@/lib/integracoes/gemini';

describe('transcrição do áudio do cliente', () => {
  it('simulado devolve o texto de exemplo', async () => {
    process.env.SIMULAR = '1';
    expect(await transcreverAudioCliente(new Uint8Array([1]), 'audio/ogg')).toBe(AUDIO_CLIENTE_SIMULADO);
  });
  it('real junta as falas do Gemini num texto só', async () => {
    const antes = { s: process.env.SIMULAR, k: process.env.GEMINI_API_KEY };
    process.env.SIMULAR = '0';
    process.env.GEMINI_API_KEY = 'teste';
    const corpos: string[] = [];
    const fetcher = (async (_u: string, init: RequestInit) => {
      corpos.push(String(init.body));
      const falas = { falas: [{ quem: 'cliente', inicio: 0, fim: 2, texto: 'Oi, ' }, { quem: 'cliente', inicio: 2, fim: 4, texto: 'tem horário?' }] };
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(falas) }] } }] }));
    }) as unknown as typeof fetch;
    try {
      const t = await transcreverAudioCliente(new Uint8Array([1, 2, 3]), 'audio/ogg; codecs=opus', fetcher);
      expect(t).toMatch(/Oi,.*tem horário\?/);
      expect(corpos[0]).toContain('"mime_type":"audio/ogg"');
    } finally {
      for (const [k, v] of [['SIMULAR', antes.s], ['GEMINI_API_KEY', antes.k]] as const) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
  it('estima a duração pelo tamanho', () => {
    expect(segundosAproxAudio(40_000)).toBe(20);
    expect(segundosAproxAudio(10)).toBe(1);
  });
});
