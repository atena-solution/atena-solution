// Galeria: filtros e ordenação puros sobre as criações de UMA empresa.
import type { Criacao, Formato, TipoCriacao } from './tipos';

export interface FiltroGaleria {
  tipo?: TipoCriacao | 'todos';
  formato?: Formato | 'todos';
  busca?: string;
  status?: Criacao['status'] | 'todos';
  desde?: string; // ISO
}

export function filtrarGaleria(criacoes: Criacao[], empresaId: string, f: FiltroGaleria = {}): Criacao[] {
  const busca = semAcento(f.busca ?? '').trim();
  return criacoes
    .filter((c) => c.empresaId === empresaId)
    .filter((c) => !f.tipo || f.tipo === 'todos' || c.tipo === f.tipo)
    .filter((c) => !f.formato || f.formato === 'todos' || c.formato === f.formato)
    .filter((c) => !f.status || f.status === 'todos' || c.status === f.status)
    .filter((c) => !f.desde || c.criadoEm >= f.desde)
    .filter((c) => !busca || semAcento(`${c.titulo} ${c.legenda ?? ''} ${(c.hashtags ?? []).join(' ')}`).includes(busca))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** Nome de arquivo para baixar: "atena-post-2026-11-01-1.png". */
export function nomeArquivo(c: Criacao, indice: number, ext = 'png'): string {
  const data = c.criadoEm.slice(0, 10);
  const titulo = semAcento(c.titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `atena-${c.tipo}-${titulo || 'criacao'}-${data}-${indice + 1}.${ext}`;
}

export function contarPorTipo(criacoes: Criacao[], empresaId: string): Partial<Record<TipoCriacao, number>> {
  const r: Partial<Record<TipoCriacao, number>> = {};
  for (const c of criacoes) if (c.empresaId === empresaId) r[c.tipo] = (r[c.tipo] ?? 0) + 1;
  return r;
}

function semAcento(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
