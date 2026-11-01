// Composição da arte do post. O TEXTO é sempre desenhado pelo sistema (canvas/SVG),
// nunca pela IA. Aqui ficam as contas puras: quebra de linha, tamanho da fonte,
// contraste e a lista de camadas que a tela desenha.
import { FORMATOS } from './prompts';
import type { Formato, KitMarca, ModeloPost } from './tipos';

// ---------- Contraste (WCAG 2.1) ----------

export function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) throw new Error(`Cor inválida: ${hex}`);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

export const CONTRASTE_MINIMO = 4.5; // AA texto normal
export const CONTRASTE_MINIMO_GRANDE = 3; // AA texto grande (títulos)

/**
 * Escolhe a cor do texto sobre um fundo. Se nenhuma candidata atinge o mínimo,
 * pede uma faixa (véu) atrás do texto com a cor que garante contraste.
 */
export function escolherCorTexto(
  fundo: string,
  candidatas: string[] = ['#FFFFFF', '#0E1116'],
  minimo = CONTRASTE_MINIMO,
): { cor: string; contraste: number; veu: string | null } {
  const ordenadas = [...candidatas]
    .map((cor) => ({ cor, contraste: contraste(fundo, cor) }))
    .sort((a, b) => b.contraste - a.contraste);
  const melhor = ordenadas[0];
  if (melhor.contraste >= minimo) return { ...melhor, veu: null };
  // Véu: escuro se o texto for claro, claro se o texto for escuro.
  const textoClaro = luminancia(melhor.cor) > 0.5;
  const veu = textoClaro ? 'rgba(14,17,22,0.62)' : 'rgba(247,245,240,0.78)';
  const corVeuSolida = textoClaro ? '#0E1116' : '#F7F5F0';
  return { cor: melhor.cor, contraste: contraste(corVeuSolida, melhor.cor), veu };
}

/** Cor média aproximada de pixels RGBA (para decidir contraste sobre a foto). */
export function corMedia(pixels: ArrayLike<number>, passo = 4): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i + 3 < pixels.length; i += 4 * passo) {
    r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; n++;
  }
  if (!n) return '#808080';
  const h = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

// ---------- Quebra de linha ----------

export type Medidor = (texto: string, tamanhoPx: number, fonte?: string, peso?: number) => number;

/** Medidor aproximado (servidor/testes). No navegador use canvas.measureText. */
export const medidorAproximado: Medidor = (texto, tamanho) => {
  let w = 0;
  for (const ch of texto) {
    if (ch === ' ') w += 0.28;
    else if ('iljtfI.,:;!|\''.includes(ch)) w += 0.3;
    else if ('mwMW@'.includes(ch)) w += 0.85;
    else if (ch >= 'A' && ch <= 'Z') w += 0.66;
    else w += 0.54;
  }
  return w * tamanho;
};

/** Quebra gulosa por palavras; palavra maior que a linha é partida com hífen. */
export function quebrarLinhas(texto: string, larguraMax: number, tamanho: number, medir: Medidor = medidorAproximado): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\n/)) {
    const palavras = paragrafo.trim().split(/\s+/).filter(Boolean);
    let atual = '';
    for (let palavra of palavras) {
      while (medir(palavra, tamanho) > larguraMax && palavra.length > 1) {
        if (atual) { linhas.push(atual); atual = ''; }
        let corte = palavra.length - 1;
        while (corte > 1 && medir(palavra.slice(0, corte) + '-', tamanho) > larguraMax) corte--;
        linhas.push(palavra.slice(0, corte) + '-');
        palavra = palavra.slice(corte);
      }
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (medir(tentativa, tamanho) <= larguraMax) atual = tentativa;
      else { if (atual) linhas.push(atual); atual = palavra; }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

export interface Ajuste {
  tamanho: number;
  linhas: string[];
  alturaLinha: number;
  cortado: boolean;
}

/** Maior fonte (entre max e min) em que o texto cabe na caixa com até maxLinhas. */
export function ajustarTexto(
  texto: string,
  caixa: { largura: number; altura: number },
  opcoes: { max: number; min: number; maxLinhas: number; entrelinha?: number },
  medir: Medidor = medidorAproximado,
): Ajuste {
  const entrelinha = opcoes.entrelinha ?? 1.15;
  for (let t = opcoes.max; t >= opcoes.min; t -= 2) {
    const linhas = quebrarLinhas(texto, caixa.largura, t, medir);
    if (linhas.length <= opcoes.maxLinhas && linhas.length * t * entrelinha <= caixa.altura) {
      return { tamanho: t, linhas, alturaLinha: t * entrelinha, cortado: false };
    }
  }
  // Não coube nem no mínimo: corta com reticências.
  const t = opcoes.min;
  const todas = quebrarLinhas(texto, caixa.largura, t, medir);
  const cabem = Math.max(1, Math.min(opcoes.maxLinhas, Math.floor(caixa.altura / (t * entrelinha))));
  const linhas = todas.slice(0, cabem);
  if (todas.length > cabem) {
    let ultima = linhas[cabem - 1].replace(/-$/, '');
    while (ultima.length > 1 && medir(ultima + '…', t) > caixa.largura) ultima = ultima.slice(0, -1);
    linhas[cabem - 1] = ultima.trimEnd() + '…';
  }
  return { tamanho: t, linhas, alturaLinha: t * entrelinha, cortado: todas.length > cabem };
}

// ---------- Layout (camadas) ----------

export type Camada =
  | { tipo: 'imagem'; src: string; x: number; y: number; largura: number; altura: number; ajuste: 'cobrir' | 'conter'; rotulo?: string }
  | { tipo: 'retangulo'; x: number; y: number; largura: number; altura: number; cor: string; raio?: number; degrade?: [string, string] }
  | { tipo: 'texto'; linhas: string[]; x: number; y: number; tamanho: number; alturaLinha: number; cor: string; fonte: string; peso: number; alinhamento: 'left' | 'center'; italico?: boolean; largura: number };

export interface TextosArte {
  titulo: string;
  subtitulo?: string;
  chamada?: string; // CTA
  autor?: string; // depoimento
}

export interface PedidoLayout {
  modelo: ModeloPost;
  formato: Formato;
  marca: KitMarca;
  textos: TextosArte;
  fundo: string; // imagem de fundo (gerada ou foto real)
  /** Para antes/depois: [antes, depois], fotos reais. */
  fotosReais?: string[];
  /** Cor média da área do texto (de corMedia); se faltar, usa a cor primária. */
  corFundoTexto?: string;
  medir?: Medidor;
}

export function montarLayout(p: PedidoLayout): { largura: number; altura: number; camadas: Camada[]; avisos: string[] } {
  const { largura: W, altura: H } = FORMATOS[p.formato];
  const medirBase = p.medir ?? medidorAproximado;
  const com = (fonte: string, peso: number): Medidor => (t, s) => medirBase(t, s, fonte, peso);
  const medir = com(p.marca.fontes.texto, 700);
  const m = Math.round(W * 0.07); // margem
  const camadas: Camada[] = [];
  const avisos: string[] = [];
  const fonteT = p.marca.fontes.titulo;
  const fonteX = p.marca.fontes.texto;

  const antesDepois = p.modelo === 'antes-depois';
  const alturaFotos = Math.round(H * 0.6);
  if (antesDepois) {
    if (!p.fotosReais || p.fotosReais.length < 2) throw new Error('Antes/depois precisa de 2 fotos reais da empresa.');
    camadas.push({ tipo: 'retangulo', x: 0, y: 0, largura: W, altura: H, cor: '#0E1116' });
    camadas.push({ tipo: 'imagem', src: p.fotosReais[0], x: 0, y: 0, largura: W / 2 - 3, altura: alturaFotos, ajuste: 'cobrir', rotulo: 'ANTES' });
    camadas.push({ tipo: 'imagem', src: p.fotosReais[1], x: W / 2 + 3, y: 0, largura: W / 2 - 3, altura: alturaFotos, ajuste: 'cobrir', rotulo: 'DEPOIS' });
  } else {
    camadas.push({ tipo: 'imagem', src: p.fundo, x: 0, y: 0, largura: W, altura: H, ajuste: 'cobrir' });
  }

  // No antes/depois o texto fica na faixa escura sólida abaixo das fotos.
  const fundoTexto = antesDepois ? '#0E1116' : p.corFundoTexto ?? p.marca.cores.primaria;
  const leitura = escolherCorTexto(fundoTexto, ['#FFFFFF', '#0E1116'], CONTRASTE_MINIMO_GRANDE);
  const corTexto = leitura.cor;

  // Área de texto: terço inferior (depoimento: centro).
  const larguraTexto = W - m * 2;
  const tituloAj = ajustarTexto(p.textos.titulo, { largura: larguraTexto, altura: H * 0.26 }, { max: Math.round(W * 0.11), min: Math.round(W * 0.05), maxLinhas: 3, entrelinha: 1.05 }, com(fonteT, 400));
  if (tituloAj.cortado) avisos.push('O título ficou longo e foi cortado. Encurte para caber.');
  const subAj = p.textos.subtitulo
    ? ajustarTexto(p.textos.subtitulo, { largura: larguraTexto, altura: H * 0.12 }, { max: Math.round(W * 0.042), min: Math.round(W * 0.03), maxLinhas: 3 }, com(fonteX, 500))
    : null;
  if (subAj?.cortado) avisos.push('O subtítulo foi cortado.');

  const alturaCta = p.textos.chamada ? Math.round(W * 0.1) : 0;
  const blocoAltura =
    tituloAj.linhas.length * tituloAj.alturaLinha + (subAj ? subAj.linhas.length * subAj.alturaLinha + m * 0.4 : 0) + (alturaCta ? alturaCta + m * 0.5 : 0);

  const centro = p.modelo === 'depoimento';
  let y = centro ? Math.round((H - blocoAltura) / 2) : Math.round(H - m - blocoAltura);
  if (antesDepois) y = Math.max(alturaFotos + m, y);
  const alinhamento = centro ? 'center' : 'left';
  const x = centro ? W / 2 : m;

  // Véu atrás do texto quando o contraste não basta (ou sempre um degradê suave no rodapé).
  if (antesDepois) {
    // faixa já é sólida
  } else if (leitura.veu) {
    camadas.push({ tipo: 'retangulo', x: 0, y: y - m, largura: W, altura: H - y + m, cor: leitura.veu });
  } else if (!centro) {
    const escuro = luminancia(corTexto) > 0.5;
    camadas.push({ tipo: 'retangulo', x: 0, y: y - m * 2, largura: W, altura: H - y + m * 2, cor: 'transparent', degrade: escuro ? ['rgba(14,17,22,0)', 'rgba(14,17,22,0.55)'] : ['rgba(247,245,240,0)', 'rgba(247,245,240,0.6)'] });
  }

  // Selo do modelo
  const selo = SELO[p.modelo];
  if (selo) {
    const tam = Math.round(W * 0.032);
    const wSelo = medir(selo, tam) + tam * 1.6;
    camadas.push({ tipo: 'retangulo', x: m, y: m, largura: wSelo, altura: tam * 2, cor: p.marca.cores.primaria, raio: tam, degrade: [p.marca.cores.primaria, p.marca.cores.secundaria] });
    const corSelo = escolherCorTexto(p.marca.cores.primaria).cor;
    camadas.push({ tipo: 'texto', linhas: [selo], x: m + tam * 0.8, y: m + tam * 0.45, tamanho: tam, alturaLinha: tam * 1.1, cor: corSelo, fonte: fonteX, peso: 700, alinhamento: 'left', largura: wSelo });
  }

  if (centro) {
    // Cartão atrás do depoimento: escuro se o texto é claro, claro se o texto é escuro.
    const cartao = leitura.veu ?? (luminancia(corTexto) > 0.5 ? 'rgba(14,17,22,0.45)' : 'rgba(247,245,240,0.6)');
    camadas.push({ tipo: 'retangulo', x: m * 0.6, y: y - m, largura: W - m * 1.2, altura: blocoAltura + m * 2, cor: cartao, raio: 28 });
  }

  camadas.push({ tipo: 'texto', linhas: tituloAj.linhas, x, y, tamanho: tituloAj.tamanho, alturaLinha: tituloAj.alturaLinha, cor: corTexto, fonte: fonteT, peso: 400, italico: fonteT === 'Instrument Serif', alinhamento, largura: larguraTexto });
  y += tituloAj.linhas.length * tituloAj.alturaLinha;
  if (subAj) {
    y += m * 0.4;
    camadas.push({ tipo: 'texto', linhas: subAj.linhas, x, y, tamanho: subAj.tamanho, alturaLinha: subAj.alturaLinha, cor: corTexto, fonte: fonteX, peso: 500, alinhamento, largura: larguraTexto });
    y += subAj.linhas.length * subAj.alturaLinha;
  }
  if (p.textos.chamada) {
    y += m * 0.5;
    const tam = Math.round(alturaCta * 0.38);
    const cta = p.textos.chamada.slice(0, 24);
    const wCta = medir(cta, tam) + tam * 2.4;
    const xCta = centro ? W / 2 - wCta / 2 : m;
    camadas.push({ tipo: 'retangulo', x: xCta, y, largura: wCta, altura: alturaCta, cor: p.marca.cores.primaria, raio: alturaCta / 2, degrade: [p.marca.cores.primaria, p.marca.cores.secundaria] });
    camadas.push({ tipo: 'texto', linhas: [cta], x: xCta + wCta / 2, y: y + (alturaCta - tam * 1.1) / 2, tamanho: tam, alturaLinha: tam * 1.1, cor: escolherCorTexto(p.marca.cores.primaria).cor, fonte: fonteX, peso: 700, alinhamento: 'center', largura: wCta });
  }

  if (p.marca.logoUrl) {
    const t = Math.round(W * 0.12);
    camadas.push({ tipo: 'imagem', src: p.marca.logoUrl, x: W - m - t, y: m, largura: t, altura: t, ajuste: 'conter' });
  }

  return { largura: W, altura: H, camadas, avisos };
}

const SELO: Record<ModeloPost, string | null> = {
  promocao: 'PROMOÇÃO',
  novidade: 'NOVIDADE',
  depoimento: null,
  'antes-depois': 'RESULTADO REAL',
};
