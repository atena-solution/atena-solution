'use client';
// Desenha a arte do post: fundo (IA ou foto real) + TEXTO renderizado pelo sistema.
// Usa montarLayout (lib/estudio/arte) com o medidor real do canvas → mesma quebra de linha na tela e no PNG.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { corMedia, montarLayout, type Camada, type Medidor, type TextosArte } from '@/lib/estudio/arte';
import type { Formato, KitMarca, ModeloPost } from '@/lib/estudio/tipos';
import { carregarImagem } from './cliente';

export interface ArteRef {
  png: () => string | null;
}

interface Props {
  modelo: ModeloPost;
  formato: Formato;
  marca: KitMarca;
  textos: TextosArte;
  fundo: string;
  fotosReais?: string[];
  className?: string;
  aoAvisar?: (avisos: string[]) => void;
}

function fonteCss(c: Extract<Camada, { tipo: 'texto' }>) {
  return `${c.italico ? 'italic ' : ''}${c.peso} ${c.tamanho}px "${c.fonte}", Inter, system-ui, sans-serif`;
}

export const Arte = forwardRef<ArteRef, Props>(function Arte(p, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pronto, setPronto] = useState(false);
  useImperativeHandle(ref, () => ({ png: () => (pronto && canvas.current ? canvas.current.toDataURL('image/png') : null) }), [pronto]);

  const chave = JSON.stringify([p.modelo, p.formato, p.marca, p.textos, p.fundo.length, p.fundo.slice(-64), p.fotosReais?.length]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const cv = canvas.current;
      if (!cv) return;
      const ctx = cv.getContext('2d')!;
      try { await document.fonts?.ready; } catch { /* ok */ }
      const italico = (f?: string) => (f === 'Instrument Serif' ? 'italic ' : '');
      const medir: Medidor = (t, tam, fonte = 'Inter', peso = 400) => {
        ctx.font = `${italico(fonte)}${peso} ${tam}px "${fonte}", Inter, sans-serif`;
        return ctx.measureText(t).width;
      };
      const fontesImagens = new Map<string, HTMLImageElement>();
      const fontes = [p.fundo, ...(p.fotosReais ?? []), p.marca.logoUrl].filter(Boolean);
      await Promise.all(fontes.map(async (s) => { try { fontesImagens.set(s, await carregarImagem(s)); } catch { /* sem imagem */ } }));
      if (cancelado) return;

      // Cor média do terço inferior do fundo → decide a cor do texto (contraste AA).
      let corFundoTexto: string | undefined;
      const fundoImg = fontesImagens.get(p.fundo);
      if (fundoImg) {
        const a = document.createElement('canvas');
        a.width = 60; a.height = 60;
        const ac = a.getContext('2d')!;
        ac.drawImage(fundoImg, 0, 0, 60, 60);
        try { corFundoTexto = corMedia(ac.getImageData(0, 40, 60, 20).data); } catch { /* imagem de outra origem */ }
      }
      const layout = montarLayout({ modelo: p.modelo, formato: p.formato, marca: p.marca, textos: p.textos, fundo: p.fundo, fotosReais: p.fotosReais, corFundoTexto, medir });
      p.aoAvisar?.(layout.avisos);
      cv.width = layout.largura;
      cv.height = layout.altura;
      ctx.clearRect(0, 0, cv.width, cv.height);
      for (const c of layout.camadas) desenhar(ctx, c, fontesImagens);
      setPronto(true);
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  return <canvas ref={canvas} className={p.className ?? 'w-full h-auto rounded-[12px] border border-[var(--e-borda)] bg-[var(--e-cartao-2)]'} role="img" aria-label={`Arte: ${p.textos.titulo}`} />;
});

function desenhar(ctx: CanvasRenderingContext2D, c: Camada, imgs: Map<string, HTMLImageElement>) {
  ctx.save();
  if (c.tipo === 'imagem') {
    const img = imgs.get(c.src);
    if (img) {
      const ri = img.naturalWidth / img.naturalHeight;
      const rc = c.largura / c.altura;
      let w = c.largura, h = c.altura;
      if (c.ajuste === 'cobrir' ? ri > rc : ri < rc) w = h * ri; else h = w / ri;
      ctx.beginPath();
      ctx.rect(c.x, c.y, c.largura, c.altura);
      ctx.clip();
      ctx.drawImage(img, c.x + (c.largura - w) / 2, c.y + (c.altura - h) / 2, w, h);
    }
    if (c.rotulo) {
      ctx.restore(); ctx.save();
      const t = Math.round(c.largura * 0.06);
      ctx.font = `700 ${t}px Inter, sans-serif`;
      const w = ctx.measureText(c.rotulo).width + t * 1.4;
      ctx.fillStyle = 'rgba(14,17,22,.72)';
      arredondado(ctx, c.x + t * 0.6, c.y + t * 0.6, w, t * 1.9, t);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.rotulo, c.x + t * 1.3, c.y + t * 0.6 + t * 0.95);
    }
  } else if (c.tipo === 'retangulo') {
    if (c.degrade) {
      const g = c.raio ? ctx.createLinearGradient(c.x, c.y, c.x + c.largura, c.y + c.altura) : ctx.createLinearGradient(0, c.y, 0, c.y + c.altura);
      g.addColorStop(0, c.degrade[0]);
      g.addColorStop(1, c.degrade[1]);
      ctx.fillStyle = g;
    } else ctx.fillStyle = c.cor;
    if (c.raio) { arredondado(ctx, c.x, c.y, c.largura, c.altura, c.raio); ctx.fill(); } else ctx.fillRect(c.x, c.y, c.largura, c.altura);
  } else {
    ctx.font = fonteCss(c);
    ctx.fillStyle = c.cor;
    ctx.textAlign = c.alinhamento;
    ctx.textBaseline = 'top';
    c.linhas.forEach((l, i) => ctx.fillText(l, c.x, c.y + i * c.alturaLinha + (c.alturaLinha - c.tamanho) / 2));
  }
  ctx.restore();
}

function arredondado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
