// Interpreta a resposta do Claude para legenda/título do post (JSON) com tolerância.
import { limpar } from './prompts';

export interface TextoPost {
  titulo: string;
  subtitulo: string;
  chamada: string;
  legenda: string;
  hashtags: string[];
}

export function lerRespostaLegenda(bruto: string, evitar: string[] = []): TextoPost {
  const inicio = bruto.indexOf('{');
  const fim = bruto.lastIndexOf('}');
  if (inicio < 0 || fim <= inicio) throw new Error('A IA não devolveu o texto no formato esperado.');
  let dados: Record<string, unknown>;
  try {
    dados = JSON.parse(bruto.slice(inicio, fim + 1));
  } catch {
    throw new Error('A IA não devolveu o texto no formato esperado.');
  }
  const s = (v: unknown, max: number) => (typeof v === 'string' ? limpar(v, max) : '');
  const hashtags = Array.isArray(dados.hashtags)
    ? Array.from(new Set(dados.hashtags.filter((h): h is string => typeof h === 'string').map(normalizarHashtag).filter(Boolean))).slice(0, 10)
    : [];
  const legenda = typeof dados.legenda === 'string' ? dados.legenda.trim().slice(0, 2200) : '';
  const r: TextoPost = {
    titulo: s(dados.titulo, 40),
    subtitulo: s(dados.subtitulo, 70),
    chamada: s(dados.chamada, 24),
    legenda,
    hashtags,
  };
  if (!r.titulo) throw new Error('A IA não sugeriu um título.');
  const proibidas = palavrasProibidas(`${r.titulo} ${r.subtitulo} ${r.legenda}`, evitar);
  if (proibidas.length) throw new Error(`O texto usou palavras que a marca evita: ${proibidas.join(', ')}.`);
  return r;
}

export function normalizarHashtag(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^#+/, '')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toLowerCase()
    .slice(0, 30);
}

export function palavrasProibidas(texto: string, evitar: string[]): string[] {
  const t = texto.toLowerCase();
  return evitar.filter((p) => p && t.includes(p.toLowerCase()));
}

export function legendaCompleta(t: Pick<TextoPost, 'legenda' | 'hashtags'>): string {
  return t.hashtags.length ? `${t.legenda}\n\n${t.hashtags.map((h) => '#' + h).join(' ')}` : t.legenda;
}

/** Separa o texto editado pelo usuário em legenda + hashtags (as do fim e as soltas no texto ficam no texto). */
export function separarLegenda(texto: string): { legenda: string; hashtags: string[] } {
  const linhas = texto.trimEnd().split('\n');
  const tags: string[] = [];
  while (linhas.length && /^\s*(#[^\s#]+\s*)+$/.test(linhas[linhas.length - 1])) {
    tags.unshift(...(linhas.pop()!.match(/#[^\s#]+/g) ?? []));
  }
  const hashtags = Array.from(new Set(tags.map(normalizarHashtag).filter(Boolean))).slice(0, 30);
  return { legenda: linhas.join('\n').trim(), hashtags };
}
