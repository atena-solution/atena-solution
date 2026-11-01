// Datas e horas no fuso da empresa. Funções puras (sem Date.now()).

export const MINUTO = 60_000
export const HORA = 60 * MINUTO
export const DIA = 24 * HORA

export interface PartesLocais {
  ano: number
  mes: number // 1..12
  dia: number
  hora: number
  minuto: number
  diaSemana: number // 0 = domingo
}

const cacheFormatos = new Map<string, Intl.DateTimeFormat>()
function formato(fuso: string) {
  let f = cacheFormatos.get(fuso)
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
      weekday: 'short',
    })
    cacheFormatos.set(fuso, f)
  }
  return f
}

const DIAS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function partesLocais(data: Date, fuso: string): PartesLocais {
  const p: Record<string, string> = {}
  for (const parte of formato(fuso).formatToParts(data)) p[parte.type] = parte.value
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaSemana: DIAS_EN.indexOf(p.weekday),
  }
}

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
function deslocamento(data: Date, fuso: string): number {
  const p = partesLocais(data, fuso)
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, data.getUTCSeconds())
  return comoUtc - (data.getTime() - data.getUTCMilliseconds())
}

/** Converte "dia local + HH:MM" do fuso para o instante real. */
export function instanteLocal(diaISO: string, hhmm: string, fuso: string): Date {
  const [a, m, d] = diaISO.split('-').map(Number)
  const [h, min] = hhmm.split(':').map(Number)
  const chute = Date.UTC(a, m - 1, d, h, min)
  let resultado = chute - deslocamento(new Date(chute), fuso)
  // segunda passada cobre mudança de horário de verão
  resultado = chute - deslocamento(new Date(resultado), fuso)
  return new Date(resultado)
}

/** 'YYYY-MM-DD' do dia local. */
export function diaLocal(data: Date, fuso: string): string {
  const p = partesLocais(data, fuso)
  return `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

export function horaLocal(data: Date, fuso: string): string {
  const p = partesLocais(data, fuso)
  return `${String(p.hora).padStart(2, '0')}:${String(p.minuto).padStart(2, '0')}`
}

export function somarDias(diaISO: string, n: number): string {
  const [a, m, d] = diaISO.split('-').map(Number)
  const t = new Date(Date.UTC(a, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

export function diaSemanaDe(diaISO: string): number {
  const [a, m, d] = diaISO.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay()
}

export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const NOMES_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const NOMES_MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "terça, 04/nov às 14:30" */
export function descreverInstante(data: Date, fuso: string): string {
  const p = partesLocais(data, fuso)
  return `${NOMES_DIA[p.diaSemana]}, ${String(p.dia).padStart(2, '0')}/${NOMES_MES[p.mes - 1]} às ${horaLocal(data, fuso)}`
}

export function nomeDiaSemana(n: number): string {
  return NOMES_DIA[n]
}

/** "agora", "3 min", "2 h", "1 d" */
export function duracaoCurta(ms: number): string {
  if (ms < MINUTO) return 'agora'
  if (ms < HORA) return `${Math.floor(ms / MINUTO)} min`
  if (ms < DIA) return `${Math.floor(ms / HORA)} h`
  return `${Math.floor(ms / DIA)} d`
}
