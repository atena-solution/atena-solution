import { describe, it, expect } from 'vitest';
import { pedidoVideoOmni, lerInteracaoVideo, urlDownloadVideo } from '../../lib/integracoes/imagem';

const foto = 'data:image/jpeg;base64,QUJD';

describe('vídeo pelo Omni', () => {
  it('monta o pedido com a foto, o roteiro e a duração no texto', () => {
    const c = pedidoVideoOmni({ prompt: 'Produto girando', foto, proporcao: '9:16', duracaoSeg: 8 }, 'gemini-omni-1.1-flash');
    expect(c.model).toBe('gemini-omni-1.1-flash');
    expect(c.background).toBe(true);
    expect(c.response_format).toEqual({ type: 'video', aspect_ratio: '9:16', delivery: 'uri' });
    const [img, txt] = c.input[0].content as { type: string; mime_type?: string; data?: string; text?: string }[];
    expect(img).toEqual({ type: 'image', mime_type: 'image/jpeg', data: 'QUJD' });
    expect(txt.text).toContain('Produto girando');
    expect(txt.text).toContain('8 segundos');
  });

  it('lê o andamento, o vídeo pronto e o bloqueio', () => {
    expect(lerInteracaoVideo({ status: 'in_progress' })).toEqual({ pronto: false });
    expect(lerInteracaoVideo({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', uri: 'https://x/v1beta/files/abc' }] }] }))
      .toEqual({ pronto: true, url: 'https://x/v1beta/files/abc' });
    expect(lerInteracaoVideo({ steps: [{ type: 'model_output', content: [{ type: 'video', data: 'AAA', mime_type: 'video/mp4' }] }] }))
      .toEqual({ pronto: true, url: 'data:video/mp4;base64,AAA' });
    const bloq = lerInteracaoVideo({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'text', text: 'Não posso gerar isso.' }] }] });
    expect(bloq).toEqual({ pronto: true, erro: 'Não posso gerar isso.' });
    expect(lerInteracaoVideo({ error: { message: 'cota' } })).toEqual({ pronto: true, erro: 'cota' });
  });

  it('converte o arquivo do Files API pro link de download', () => {
    expect(urlDownloadVideo('https://generativelanguage.googleapis.com/v1beta/files/abc-1'))
      .toBe('https://generativelanguage.googleapis.com/download/v1beta/files/abc-1:download?alt=media');
    expect(urlDownloadVideo('https://outro/x.mp4')).toBe('https://outro/x.mp4');
  });
});
