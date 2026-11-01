/** Formatação para a tela (pt-BR). Funções puras. */

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** "5511999998888" → "(11) 99999-8888". Outros formatos voltam como vieram. */
export function formatarTelefone(e164: string): string {
  const d = e164.replace(/\D/g, '');
  const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return e164;
}

/**
 * Normaliza um telefone digitado para E.164 sem "+", assumindo Brasil (55) quando faltar o país.
 * Devolve null quando não parece um telefone válido.
 */
export function normalizarTelefone(entrada: string): string | null {
  let d = entrada.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  if (d.length < 12 || d.length > 15) return null;
  return d;
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function formatarReais(valor: number): string {
  return moeda.format(valor).replace(/ /g, ' ');
}

/** "há 5 min", "há 2 h", "ontem", "12/03". */
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const diff = (agora.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ontem';
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Remove acentos e caixa, para buscas. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
