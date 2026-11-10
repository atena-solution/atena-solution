import { describe, it, expect, vi } from 'vitest';
import { FilaDeEnvio, type PedacoGravado } from '../../lib/coach/gravador-navegador';

const p = (indice: number): PedacoGravado => ({ trilha: 'misto', indice, inicioSeg: indice * 300, duracaoSeg: 300, blob: new Blob(['x']) });

describe('FilaDeEnvio', () => {
  it('envia em ordem, um por vez', async () => {
    const enviados: number[] = [];
    const f = new FilaDeEnvio(async (x) => { enviados.push(x.indice); });
    f.adicionar(p(0)); f.adicionar(p(1)); f.adicionar(p(2));
    await f.esvaziar();
    expect(enviados).toEqual([0, 1, 2]);
  });
  it('tenta 3 vezes e guarda a falha pra tentar de novo', async () => {
    vi.useFakeTimers();
    let tentativas = 0;
    let quebrar = true;
    const f = new FilaDeEnvio(async () => { tentativas++; if (quebrar) throw new Error('sem internet'); });
    f.adicionar(p(0));
    await vi.runAllTimersAsync();
    expect(tentativas).toBe(3);
    expect(f.falhas).toHaveLength(1);
    quebrar = false;
    f.tentarFalhas();
    await vi.runAllTimersAsync();
    expect(f.falhas).toHaveLength(0);
    expect(tentativas).toBe(4);
    vi.useRealTimers();
  });
});
