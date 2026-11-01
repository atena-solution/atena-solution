import type { Resultado, StatusEtapa, StatusReuniao } from '@/lib/coach/tipos';

export const RESULTADO: Record<Resultado, { texto: string; tom: 'ok' | 'atencao' | 'erro' | 'acento' }> = {
  fechou: { texto: 'Fechou', tom: 'ok' },
  retorno: { texto: 'Retorno', tom: 'acento' },
  pensando: { texto: 'Vai pensar', tom: 'atencao' },
  sem_interesse: { texto: 'Sem interesse', tom: 'erro' },
};

export const ETAPA: Record<StatusEtapa, { texto: string; tom: 'ok' | 'atencao' | 'erro' }> = {
  feita: { texto: 'Feita', tom: 'ok' },
  parcial: { texto: 'Parcial', tom: 'atencao' },
  nao_feita: { texto: 'Não feita', tom: 'erro' },
};

export const STATUS: Record<StatusReuniao, string> = {
  gravando: 'Gravando',
  transcrevendo: 'Transcrevendo',
  analisando: 'Analisando',
  pronta: 'Pronta',
  erro: 'Com erro',
};

export function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' });
}
export function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
}
export function corNota(n: number | null | undefined) {
  if (n === null || n === undefined) return 'var(--coach-suave)';
  return n >= 8 ? 'var(--coach-ok)' : n >= 6 ? 'var(--coach-atencao)' : 'var(--coach-erro)';
}

/** Nota com uma casa e vírgula: 7,5 */
export function nota(n: number | null | undefined) {
  return n === null || n === undefined ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
