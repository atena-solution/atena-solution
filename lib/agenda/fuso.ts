/** Datas no fuso da empresa (funções puras, sem bibliotecas). */

const formatadores = new Map<string, Intl.DateTimeFormat>();
function fmt(fuso: string) {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: fuso,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatadores.set(fuso, f);
  }
  return f;
}

function partes(instante: Date, fuso: string) {
  const p: Record<string, string> = {};
  for (const x of fmt(fuso).formatToParts(instante)) p[x.type] = x.value;
  return {
    ano: +p.year,
    mes: +p.month,
    dia: +p.day,
    hora: +p.hour,
    minuto: +p.minute,
    segundo: +p.second,
  };
}

/** Diferença (em minutos) entre o horário local do fuso e o UTC, naquele instante. São Paulo = -180. */
export function offsetMin(fuso: string, instante: Date): number {
  const p = partes(instante, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000);
}

/** 'HH:MM' → minutos desde a meia-noite. */
export function hhmmParaMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`Hora inválida: ${hhmm}`);
  return +m[1] * 60 + +m[2];
}

export function minParaHhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Instante (Date UTC) de uma data+hora local no fuso. */
export function instanteLocal(data: string, minutosDoDia: number, fuso: string): Date {
  const [a, m, d] = data.split('-').map(Number);
  const palpite = Date.UTC(a, m - 1, d, 0, minutosDoDia);
  // duas passadas resolvem a virada de horário de verão (quando houver)
  let t = palpite - offsetMin(fuso, new Date(palpite)) * 60000;
  t = palpite - offsetMin(fuso, new Date(t)) * 60000;
  return new Date(t);
}

/** 'YYYY-MM-DD' do instante no fuso. */
export function dataLocal(instante: Date | string, fuso: string): string {
  const p = partes(new Date(instante), fuso);
  return `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`;
}

/** Minutos desde a meia-noite local. */
export function minutosLocais(instante: Date | string, fuso: string): number {
  const p = partes(new Date(instante), fuso);
  return p.hora * 60 + p.minuto;
}

export function horaLocal(instante: Date | string, fuso: string): string {
  return minParaHhmm(minutosLocais(instante, fuso));
}

/** Dia da semana (0 = domingo) de uma data 'YYYY-MM-DD'. */
export function diaDaSemana(data: string): number {
  const [a, m, d] = data.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export function somarDias(data: string, n: number): string {
  const [a, m, d] = data.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

/** Os 7 dias (segunda a domingo) da semana que contém `data`. */
export function semanaDe(data: string): string[] {
  const dow = diaDaSemana(data);
  const segunda = somarDias(data, dow === 0 ? -6 : 1 - dow);
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const NOMES_DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function nomeDia(dia: number, curto = false): string {
  return (curto ? NOMES_DIA_CURTO : NOMES_DIA)[dia];
}
