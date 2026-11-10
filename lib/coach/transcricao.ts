// Regras puras da transcrição: deslocar falas do pedaço pro tempo da reunião,
// juntar as trilhas por tempo, % de fala e achar a fala no tempo do player.
import type { Fala, Falante, Pedaco } from './tipos';

/** Coloca as falas de um pedaço no tempo da reunião (soma o início do pedaço). */
export function deslocarFalas(falas: Fala[], inicioPedacoSeg: number): Fala[] {
  return falas.map((f) => ({
    ...f,
    inicioSeg: arred(f.inicioSeg + inicioPedacoSeg),
    fimSeg: arred(Math.max(f.fimSeg, f.inicioSeg) + inicioPedacoSeg),
  }));
}

/**
 * Junta as falas de todos os pedaços (de todas as trilhas) numa linha do tempo só.
 * - ordena por início (empate: vendedor antes, depois menor fim);
 * - descarta falas vazias;
 * - funde falas seguidas da MESMA pessoa com intervalo curto (padrão 1,5 s).
 */
export function juntarTrilhas(pedacos: Pedaco[], opcoes: { fundirAteSeg?: number } = {}): Fala[] {
  const fundirAte = opcoes.fundirAteSeg ?? 1.5;
  const todas: Fala[] = [];
  for (const p of pedacos) {
    if (p.status !== 'transcrito') continue;
    for (const f of p.falas) {
      const texto = f.texto.trim();
      if (!texto) continue;
      todas.push({ ...f, texto });
    }
  }
  todas.sort(
    (a, b) =>
      a.inicioSeg - b.inicioSeg ||
      ordemFalante(a.quem) - ordemFalante(b.quem) ||
      a.fimSeg - b.fimSeg,
  );

  const saida: Fala[] = [];
  for (const f of todas) {
    const ult = saida[saida.length - 1];
    if (ult && ult.quem === f.quem && f.inicioSeg - ult.fimSeg <= fundirAte && f.inicioSeg >= ult.inicioSeg) {
      ult.texto = `${ult.texto} ${f.texto}`;
      ult.fimSeg = Math.max(ult.fimSeg, f.fimSeg);
      continue;
    }
    saida.push({ ...f });
  }
  return saida;
}

function ordemFalante(q: Falante): number {
  return q === 'vendedor' ? 0 : q === 'cliente' ? 1 : 2;
}

/**
 * % de fala vendedor × cliente pelo TEMPO falado (sobreposição conta pros dois).
 * Falas "desconhecido" ficam de fora. Soma sempre 100 (ou 0/0 sem falas).
 */
export function porcentagemFala(falas: Fala[]): { vendedorPct: number; clientePct: number } {
  let v = 0;
  let c = 0;
  for (const f of falas) {
    const d = Math.max(0, f.fimSeg - f.inicioSeg);
    if (f.quem === 'vendedor') v += d;
    else if (f.quem === 'cliente') c += d;
  }
  const total = v + c;
  if (total === 0) return { vendedorPct: 0, clientePct: 0 };
  const vendedorPct = Math.round((v / total) * 100);
  return { vendedorPct, clientePct: 100 - vendedorPct };
}

/** Índice da fala que está tocando no segundo `t` (ou a última que já começou). -1 se nenhuma. */
export function falaNoTempo(falas: Fala[], t: number): number {
  let lo = 0;
  let hi = falas.length - 1;
  let achou = -1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    if (falas[meio].inicioSeg <= t) {
      achou = meio;
      lo = meio + 1;
    } else hi = meio - 1;
  }
  return achou;
}

/** Duração da reunião = maior fim entre pedaços e falas. */
export function duracaoTotal(pedacos: Pedaco[]): number {
  let max = 0;
  for (const p of pedacos) {
    max = Math.max(max, p.inicioSeg + p.duracaoSeg);
    for (const f of p.falas) max = Math.max(max, f.fimSeg);
  }
  return arred(max);
}

/** "mm:ss" ou "h:mm:ss". */
export function formatarTempo(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dois = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dois(m)}:${dois(r)}` : `${dois(m)}:${dois(r)}`;
}

/** Texto da transcrição pro prompt da IA: "[03:12] Vendedor: ...". */
export function transcricaoParaTexto(falas: Fala[]): string {
  const nome: Record<Falante, string> = { vendedor: 'Vendedor', cliente: 'Cliente', desconhecido: 'Alguém' };
  return falas.map((f) => `[${formatarTempo(f.inicioSeg)}] ${nome[f.quem]}: ${f.texto}`).join('\n');
}

function arred(n: number): number {
  return Math.round(n * 100) / 100;
}
