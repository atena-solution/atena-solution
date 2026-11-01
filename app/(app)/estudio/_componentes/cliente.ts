'use client';
// Chamadas do navegador para /api/estudio — com o mesmo login da Base.
import { cabecalhosLogin } from '@/lib/sessao';

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string, public dados: Record<string, unknown> = {}) {
    super(mensagem);
  }
}

export async function chamar<T = unknown>(url: string, opcoes: { metodo?: string; corpo?: unknown } = {}): Promise<T> {
  const resp = await fetch(url, {
    method: opcoes.metodo ?? (opcoes.corpo !== undefined ? 'POST' : 'GET'),
    headers: { ...(await cabecalhosLogin()), ...(opcoes.corpo !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined,
    cache: 'no-store',
  });
  let dados: Record<string, unknown> = {};
  try {
    dados = await resp.json();
  } catch {
    /* sem corpo */
  }
  if (!resp.ok) throw new ErroApi(resp.status, String(dados.erro ?? 'Algo deu errado. Tente de novo.'), dados);
  return dados as T;
}

/** Avisa o cabeçalho do Estúdio que o saldo mudou. */
export function avisarSaldo(saldo: number) {
  window.dispatchEvent(new CustomEvent('estudio:saldo', { detail: saldo }));
}

/** Lê o arquivo e reduz para no máximo `lado` px (JPEG), para subir rápido e caber no limite. */
export async function prepararFoto(arquivo: File, lado = 1280, qualidade = 0.86): Promise<string> {
  if (!/^image\/(png|jpeg|webp|heic|heif)$/.test(arquivo.type) && !arquivo.type.startsWith('image/')) throw new Error('Envie uma imagem (JPG, PNG ou WEBP).');
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await carregarImagem(url);
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', qualidade);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error('Não foi possível abrir a imagem.'));
    img.src = src;
  });
}

export function baixar(url: string, nome: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Converte imagem (inclusive SVG) para PNG para baixar. */
export async function paraPng(src: string, largura: number, altura: number): Promise<string> {
  if (src.startsWith('data:image/png')) return src;
  const img = await carregarImagem(src);
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = altura;
  c.getContext('2d')!.drawImage(img, 0, 0, largura, altura);
  return c.toDataURL('image/png');
}
