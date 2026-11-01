import { describe, it, expect } from 'vitest';
import { validarArquivo, janelasDeTranscricao, trilhasDoModo, avisoAudioDaAba, proximoPedaco, registrarPedaco, andamento, LIMITE_ARQUIVO_BYTES } from '../../lib/coach/gravacao';
import type { Pedaco } from '../../lib/coach/tipos';

const p = (trilha: Pedaco['trilha'], indice: number, status: Pedaco['status'] = 'transcrito'): Pedaco => ({ trilha, indice, inicioSeg: indice * 300, duracaoSeg: 300, status, falas: [] });

describe('arquivo', () => {
  it('aceita áudio e vídeo comuns', () => {
    expect(validarArquivo({ nome: 'a.mp3', mime: 'audio/mpeg', bytes: 10 })).toBeNull();
    expect(validarArquivo({ nome: 'a.webm', mime: 'audio/webm;codecs=opus', bytes: 10 })).toBeNull();
    expect(validarArquivo({ nome: 'call.m4a', mime: '', bytes: 10 })).toBeNull();
  });
  it('recusa grande, vazio e formato errado', () => {
    expect(validarArquivo({ nome: 'a.mp3', mime: 'audio/mpeg', bytes: LIMITE_ARQUIVO_BYTES + 1 })).toMatch(/200 MB/);
    expect(validarArquivo({ nome: 'a.mp3', mime: 'audio/mpeg', bytes: 0 })).toMatch(/vazio/);
    expect(validarArquivo({ nome: 'a.pdf', mime: 'application/pdf', bytes: 5 })).toMatch(/Formato/);
  });
  it('divide em janelas de 10 min', () => {
    expect(janelasDeTranscricao(1500)).toEqual([{ inicioSeg: 0, fimSeg: 600 }, { inicioSeg: 600, fimSeg: 1200 }, { inicioSeg: 1200, fimSeg: 1500 }]);
    expect(janelasDeTranscricao(0)).toEqual([]);
  });
});

describe('gravação no navegador', () => {
  it('trilhas por modo', () => {
    expect(trilhasDoModo('duas-trilhas')).toEqual(['vendedor', 'cliente']);
    expect(trilhasDoModo('so-microfone')).toEqual(['misto']);
  });
  it('avisa quando vem sem áudio da aba', () => {
    expect(avisoAudioDaAba(0)).toMatch(/sem o áudio da aba/);
    expect(avisoAudioDaAba(1)).toBeNull();
  });
  it('próximo pedaço continua de onde parou', () => {
    expect(proximoPedaco([], 'vendedor')).toEqual({ indice: 0, inicioSeg: 0 });
    expect(proximoPedaco([p('vendedor', 0), p('vendedor', 1), p('cliente', 0)], 'vendedor')).toEqual({ indice: 2, inicioSeg: 600 });
  });
  it('reenvio substitui o mesmo pedaço', () => {
    const l = registrarPedaco([p('vendedor', 0, 'erro'), p('cliente', 0)], p('vendedor', 0));
    expect(l).toHaveLength(2);
    expect(l.find((x) => x.trilha === 'vendedor')!.status).toBe('transcrito');
  });
  it('andamento', () => {
    expect(andamento([p('vendedor', 0), p('cliente', 0, 'enviado')])).toMatchObject({ total: 2, transcritos: 1, pronto: false });
    expect(andamento([p('vendedor', 0), p('cliente', 0, 'erro')]).pronto).toBe(true);
    expect(andamento([]).pronto).toBe(false);
  });
});
