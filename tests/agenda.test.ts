import { describe, expect, it } from 'vitest';
import { horariosLivres, verificarHorario, temConflito, janelasDeTrabalho, podeMudarStatus } from '@/lib/agenda/horarios';
import { dataLocal, diaDaSemana, horaLocal, instanteLocal, offsetMin, semanaDe, somarDias } from '@/lib/agenda/fuso';
import type { Agendamento, HorarioDia } from '@/lib/tipos';

const SP = 'America/Sao_Paulo';
const empresa: HorarioDia[] = [{ dia: 1, abre: '09:00', fecha: '12:00' }]; // segunda
const SEGUNDA = '2026-11-02';
const prof = { id: 'p1', horarios: [] as HorarioDia[], servicosIds: ['s1'] };

function ag(id: string, ini: string, fim: string, status: Agendamento['status'] = 'marcado', profissionalId = 'p1') {
  return { id, profissionalId, inicio: new Date(ini).toISOString(), fim: new Date(fim).toISOString(), status };
}

describe('fuso', () => {
  it('São Paulo é UTC-3', () => {
    expect(offsetMin(SP, new Date('2026-11-02T12:00:00Z'))).toBe(-180);
    expect(instanteLocal(SEGUNDA, 9 * 60, SP).toISOString()).toBe('2026-11-02T12:00:00.000Z');
  });
  it('data e hora locais', () => {
    expect(dataLocal('2026-11-03T01:30:00Z', SP)).toBe(SEGUNDA); // 22:30 de segunda em SP
    expect(horaLocal('2026-11-02T12:15:00Z', SP)).toBe('09:15');
    expect(diaDaSemana(SEGUNDA)).toBe(1);
  });
  it('semana começa na segunda', () => {
    const s = semanaDe('2026-11-05');
    expect(s[0]).toBe(SEGUNDA);
    expect(s[6]).toBe('2026-11-08');
    expect(semanaDe('2026-11-08')[0]).toBe(SEGUNDA); // domingo
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('horariosLivres', () => {
  const base = { data: SEGUNDA, fuso: SP, horariosEmpresa: empresa, profissional: prof, agendamentos: [] };

  it('oferece horários a cada 15 min dentro do expediente', () => {
    const l = horariosLivres({ ...base, duracaoMin: 60 });
    expect(l[0]).toBe('2026-11-02T12:00:00.000Z'); // 09:00 SP
    expect(l.at(-1)).toBe('2026-11-02T14:00:00.000Z'); // 11:00 SP (termina 12:00)
    expect(l).toHaveLength(9);
  });

  it('dia fechado não tem horário', () => {
    expect(horariosLivres({ ...base, data: '2026-11-03', duracaoMin: 30 })).toEqual([]);
  });

  it('pula horários ocupados e respeita a folga', () => {
    const agendamentos = [ag('a', '2026-11-02T13:00:00Z', '2026-11-02T13:30:00Z')]; // 10:00–10:30
    const l = horariosLivres({ ...base, duracaoMin: 30, agendamentos }).map((i) => horaLocal(i, SP));
    expect(l).toContain('09:30');
    expect(l).not.toContain('09:45');
    expect(l).not.toContain('10:00');
    expect(l).toContain('10:30');
    const comFolga = horariosLivres({ ...base, duracaoMin: 30, agendamentos, folgaMin: 15 }).map((i) => horaLocal(i, SP));
    expect(comFolga).not.toContain('09:30');
    expect(comFolga).not.toContain('10:30');
    expect(comFolga).toContain('10:45');
  });

  it('cancelado libera e outro profissional não atrapalha', () => {
    const agendamentos = [
      ag('a', '2026-11-02T13:00:00Z', '2026-11-02T13:30:00Z', 'cancelado'),
      ag('b', '2026-11-02T13:00:00Z', '2026-11-02T13:30:00Z', 'marcado', 'p2'),
    ];
    expect(horariosLivres({ ...base, duracaoMin: 30, agendamentos }).map((i) => horaLocal(i, SP))).toContain('10:00');
  });

  it('não oferece o passado nem dentro da antecedência', () => {
    const agora = new Date('2026-11-02T13:05:00Z'); // 10:05
    const l = horariosLivres({ ...base, duracaoMin: 30, agora, antecedenciaMin: 30 }).map((i) => horaLocal(i, SP));
    expect(l[0]).toBe('10:45');
  });

  it('usa a interseção com o horário do profissional (pausa de almoço)', () => {
    const emp: HorarioDia[] = [{ dia: 1, abre: '09:00', fecha: '18:00' }];
    const p = { id: 'p1', servicosIds: [], horarios: [{ dia: 1, abre: '08:00', fecha: '12:00' }, { dia: 1, abre: '13:00', fecha: '15:00' }] };
    expect(janelasDeTrabalho(SEGUNDA, emp, p)).toEqual([
      { inicio: 540, fim: 720 },
      { inicio: 780, fim: 900 },
    ]);
    const l = horariosLivres({ ...base, horariosEmpresa: emp, profissional: p, duracaoMin: 60, passoMin: 60 }).map((i) => horaLocal(i, SP));
    expect(l).toEqual(['09:00', '10:00', '11:00', '13:00', '14:00']);
  });

  it('duração inválida não devolve nada', () => {
    expect(horariosLivres({ ...base, duracaoMin: 0 })).toEqual([]);
  });
});

describe('verificarHorario', () => {
  const base = { duracaoMin: 30, fuso: SP, horariosEmpresa: empresa, profissional: prof, servicoId: 's1', agendamentos: [ag('a', '2026-11-02T13:00:00Z', '2026-11-02T13:30:00Z')] };
  it('aceita horário livre', () => {
    expect(verificarHorario({ ...base, inicio: '2026-11-02T12:00:00Z' })).toEqual({ ok: true });
  });
  it('recusa horário ocupado (a IA não consegue marcar por cima)', () => {
    const r = verificarHorario({ ...base, inicio: '2026-11-02T13:15:00Z' });
    expect(r.ok).toBe(false);
  });
  it('remarcar o próprio agendamento no mesmo lugar é permitido', () => {
    expect(verificarHorario({ ...base, inicio: '2026-11-02T13:00:00Z', ignorarId: 'a' }).ok).toBe(true);
  });
  it('recusa fora do expediente, passado e serviço que o profissional não faz', () => {
    expect(verificarHorario({ ...base, inicio: '2026-11-02T14:45:00Z' }).ok).toBe(false); // 11:45 + 30
    expect(verificarHorario({ ...base, inicio: '2026-11-02T12:00:00Z', agora: new Date('2026-11-02T12:30:00Z') }).ok).toBe(false);
    expect(verificarHorario({ ...base, inicio: '2026-11-02T12:00:00Z', servicoId: 's9' }).ok).toBe(false);
    expect(verificarHorario({ ...base, inicio: 'xx' }).ok).toBe(false);
  });
  it('temConflito', () => {
    expect(temConflito(base.agendamentos, 'p1', '2026-11-02T13:29:00Z', '2026-11-02T14:00:00Z')).toBe(true);
    expect(temConflito(base.agendamentos, 'p1', '2026-11-02T13:30:00Z', '2026-11-02T14:00:00Z')).toBe(false);
  });
  it('status: cancelado é final', () => {
    expect(podeMudarStatus('marcado', 'confirmado')).toBe(true);
    expect(podeMudarStatus('cancelado', 'marcado')).toBe(false);
  });
});
