import type { Agendamento, HorarioDia, Profissional, StatusAgendamento } from '../tipos';
import { dataLocal, diaDaSemana, hhmmParaMin, instanteLocal, minutosLocais } from './fuso';

/** Intervalo em minutos desde a meia-noite local [inicio, fim). */
export interface Janela {
  inicio: number;
  fim: number;
}

/** Status que ocupam a agenda (cancelado libera o horário). */
export const STATUS_QUE_OCUPAM: StatusAgendamento[] = ['marcado', 'confirmado', 'compareceu', 'faltou'];

export function janelasDoDia(horarios: HorarioDia[], dia: number): Janela[] {
  return horarios
    .filter((h) => h.dia === dia)
    .map((h) => ({ inicio: hhmmParaMin(h.abre), fim: hhmmParaMin(h.fecha) }))
    .filter((j) => j.fim > j.inicio)
    .sort((a, b) => a.inicio - b.inicio);
}

/** Interseção de duas listas de janelas. */
export function intersecao(a: Janela[], b: Janela[]): Janela[] {
  const r: Janela[] = [];
  for (const x of a)
    for (const y of b) {
      const inicio = Math.max(x.inicio, y.inicio);
      const fim = Math.min(x.fim, y.fim);
      if (fim > inicio) r.push({ inicio, fim });
    }
  return r.sort((p, q) => p.inicio - q.inicio);
}

/** Janelas de trabalho do profissional no dia: horário da empresa ∩ horário dele (se tiver). */
export function janelasDeTrabalho(data: string, horariosEmpresa: HorarioDia[], profissional: Pick<Profissional, 'horarios'>): Janela[] {
  const dia = diaDaSemana(data);
  const empresa = janelasDoDia(horariosEmpresa, dia);
  if (!profissional.horarios || profissional.horarios.length === 0) return empresa;
  return intersecao(empresa, janelasDoDia(profissional.horarios, dia));
}

function sobrepoe(aIni: number, aFim: number, bIni: number, bFim: number) {
  return aIni < bFim && bIni < aFim;
}

/** Há outro agendamento do mesmo profissional ocupando [inicio, fim)? */
export function temConflito(
  agendamentos: Pick<Agendamento, 'id' | 'profissionalId' | 'inicio' | 'fim' | 'status'>[],
  profissionalId: string,
  inicio: string | Date,
  fim: string | Date,
  ignorarId?: string,
): boolean {
  const i = new Date(inicio).getTime();
  const f = new Date(fim).getTime();
  return agendamentos.some(
    (a) =>
      a.id !== ignorarId &&
      a.profissionalId === profissionalId &&
      STATUS_QUE_OCUPAM.includes(a.status) &&
      sobrepoe(i, f, new Date(a.inicio).getTime(), new Date(a.fim).getTime()),
  );
}

export interface ParametrosHorariosLivres {
  /** Dia local 'YYYY-MM-DD'. */
  data: string;
  fuso: string;
  duracaoMin: number;
  horariosEmpresa: HorarioDia[];
  profissional: Pick<Profissional, 'id' | 'horarios'>;
  /** Agendamentos da empresa (os de outros profissionais e os cancelados são ignorados). */
  agendamentos: Pick<Agendamento, 'id' | 'profissionalId' | 'inicio' | 'fim' | 'status'>[];
  /** De quanto em quanto tempo oferecer horários (padrão 15 min). */
  passoMin?: number;
  /** Agora (para não oferecer horário no passado). */
  agora?: Date;
  /** Antecedência mínima em minutos (padrão 0). */
  antecedenciaMin?: number;
  /** Folga entre atendimentos em minutos (padrão 0). */
  folgaMin?: number;
  /** Ignora este agendamento (remarcação). */
  ignorarId?: string;
}

/**
 * Horários livres (início de cada opção, em ISO UTC) para um serviço de `duracaoMin`
 * com um profissional num dia. Respeita: horário da empresa, horário do profissional,
 * agendamentos existentes (+ folga), passado e antecedência.
 */
export function horariosLivres(p: ParametrosHorariosLivres): string[] {
  const passo = p.passoMin ?? 15;
  const folga = p.folgaMin ?? 0;
  if (p.duracaoMin <= 0 || passo <= 0) return [];
  const janelas = janelasDeTrabalho(p.data, p.horariosEmpresa, p.profissional);
  const limite = p.agora ? p.agora.getTime() + (p.antecedenciaMin ?? 0) * 60000 : -Infinity;

  // ocupados do dia, em minutos locais (com folga dos dois lados)
  const ocupados: Janela[] = p.agendamentos
    .filter((a) => a.id !== p.ignorarId && a.profissionalId === p.profissional.id && STATUS_QUE_OCUPAM.includes(a.status))
    .filter((a) => dataLocal(a.inicio, p.fuso) === p.data || dataLocal(a.fim, p.fuso) === p.data)
    .map((a) => {
      const ini = dataLocal(a.inicio, p.fuso) === p.data ? minutosLocais(a.inicio, p.fuso) : 0;
      const fim = dataLocal(a.fim, p.fuso) === p.data ? minutosLocais(a.fim, p.fuso) : 24 * 60;
      return { inicio: ini - folga, fim: fim + folga };
    });

  const livres: string[] = [];
  for (const j of janelas) {
    // alinha ao passo a partir do início da janela
    for (let ini = j.inicio; ini + p.duracaoMin <= j.fim; ini += passo) {
      const fim = ini + p.duracaoMin;
      if (ocupados.some((o) => sobrepoe(ini, fim, o.inicio, o.fim))) continue;
      const instante = instanteLocal(p.data, ini, p.fuso);
      if (instante.getTime() < limite) continue;
      livres.push(instante.toISOString());
    }
  }
  return livres;
}

export type Verificacao = { ok: true } | { ok: false; motivo: string };

/** Confere se um horário escolhido pode ser marcado (usado ao criar/remarcar e pela IA). */
export function verificarHorario(p: {
  inicio: string;
  duracaoMin: number;
  fuso: string;
  horariosEmpresa: HorarioDia[];
  profissional: Pick<Profissional, 'id' | 'horarios' | 'servicosIds'>;
  servicoId: string;
  agendamentos: Pick<Agendamento, 'id' | 'profissionalId' | 'inicio' | 'fim' | 'status'>[];
  agora?: Date;
  ignorarId?: string;
}): Verificacao {
  const inicio = new Date(p.inicio);
  if (Number.isNaN(inicio.getTime())) return { ok: false, motivo: 'Data/hora inválida.' };
  if (p.profissional.servicosIds.length > 0 && !p.profissional.servicosIds.includes(p.servicoId)) {
    return { ok: false, motivo: 'Este profissional não faz esse serviço.' };
  }
  if (p.agora && inicio.getTime() < p.agora.getTime()) return { ok: false, motivo: 'Esse horário já passou.' };
  const fim = new Date(inicio.getTime() + p.duracaoMin * 60000);
  const data = dataLocal(inicio, p.fuso);
  const ini = minutosLocais(inicio, p.fuso);
  const janelas = janelasDeTrabalho(data, p.horariosEmpresa, p.profissional);
  if (!janelas.some((j) => ini >= j.inicio && ini + p.duracaoMin <= j.fim)) {
    return { ok: false, motivo: 'Fora do horário de atendimento.' };
  }
  if (temConflito(p.agendamentos, p.profissional.id, inicio, fim, p.ignorarId)) {
    return { ok: false, motivo: 'Esse horário já está ocupado.' };
  }
  return { ok: true };
}

/** Transições de status permitidas. Cancelado é final (para voltar, marque de novo). */
export function podeMudarStatus(atual: StatusAgendamento, novo: StatusAgendamento): boolean {
  if (atual === novo) return true;
  if (atual === 'cancelado') return false;
  return true;
}

export const NOME_STATUS: Record<StatusAgendamento, string> = {
  marcado: 'Marcado',
  confirmado: 'Confirmado',
  compareceu: 'Compareceu',
  faltou: 'Faltou',
  cancelado: 'Cancelado',
};
