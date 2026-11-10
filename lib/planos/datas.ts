// Datas — funções puras. Tudo em ISO (UTC) no banco; "dia" do vencimento segue o fuso de São Paulo.

const DIA_MS = 24 * 60 * 60 * 1000;

export function somarDias(iso: string, dias: number): string {
  return new Date(new Date(iso).getTime() + dias * DIA_MS).toISOString();
}

/** Soma meses mantendo o dia; se o mês não tem o dia (31/01 + 1 mês), cai no último dia do mês. */
export function somarMeses(iso: string, meses: number): string {
  const d = new Date(iso);
  const dia = d.getUTCDate();
  const alvo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + meses, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString();
}

export function diasEntre(deIso: string, ateIso: string): number {
  return (new Date(ateIso).getTime() - new Date(deIso).getTime()) / DIA_MS;
}

export function maisTarde(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/** "AAAA-MM-DD" no fuso de São Paulo (formato de data que o Asaas usa). */
export function dataSP(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** Fim do dia "AAAA-MM-DD" em São Paulo (23:59:59 -03:00), em ISO UTC. */
export function fimDoDiaSP(dataAAAAMMDD: string): string {
  // Brasil sem horário de verão desde 2019: São Paulo = UTC-3.
  return new Date(`${dataAAAAMMDD}T23:59:59.999-03:00`).toISOString();
}

export function formatarDataBR(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));
}
