// Junção: uma regra só para "horário ocupado" e a mesma trava para a equipe (Agenda) e a IA (Atendimento).
import { beforeEach, describe, expect, it } from 'vitest';
import { BancoMemoria } from '@/lib/dados/banco';
import { daEmpresa } from '@/lib/dados/empresa';
import { semearDemo } from '@/lib/dados/demo';
import { dataLocal, diaDaSemana, instanteLocal, somarDias } from '@/lib/agenda/fuso';
import { marcarAgendamento, remarcarAgendamento } from '@/lib/agenda/operacoes';
import { caminhoTravaAgenda, travaLocal } from '@/lib/agenda/trava';
import { RepoBanco } from '@/lib/atendimento/repo-banco';

process.env.SIMULAR = '1';
const FUSO = 'America/Sao_Paulo';

function proximoDiaUtil() {
  let d = somarDias(dataLocal(new Date(), FUSO), 2);
  while ([0, 6].includes(diaDaSemana(d))) d = somarDias(d, 1);
  return d;
}

let b: BancoMemoria;
beforeEach(async () => {
  b = new BancoMemoria();
  await semearDemo(b);
});

describe('agenda unificada', () => {
  it('equipe e IA ao mesmo tempo no mesmo horário: só um leva', async () => {
    const dia = proximoDiaUtil();
    const inicio = instanteLocal(dia, 14 * 60, FUSO);
    const fim = new Date(inicio.getTime() + 60 * 60000);
    const dados = daEmpresa(b, 'demo');
    const repo = new RepoBanco(b);
    const [equipe, ia] = await Promise.allSettled([
      marcarAgendamento(dados, { contatoId: 'ct-1', servicoId: 'sv-limpeza', profissionalId: 'pf-julia', inicio: inicio.toISOString() }, { uid: 'demo-dono' }),
      repo.criarAgendamentoSeLivre('demo', { contatoId: 'ct-2', servicoId: 'sv-limpeza', profissionalId: 'pf-julia', inicio: inicio.toISOString(), fim: fim.toISOString(), status: 'marcado', criadoPor: 'ia', lembretes: {} }),
    ]);
    const equipeLevou = equipe.status === 'fulfilled';
    const iaLevou = ia.status === 'fulfilled' && ia.value !== null;
    expect([equipeLevou, iaLevou].filter(Boolean)).toHaveLength(1);
    const doDia = (await dados.listar<{ inicio: string; profissionalId: string; status: string }>('agendamentos')).filter((a) => a.inicio === inicio.toISOString() && a.profissionalId === 'pf-julia');
    expect(doDia).toHaveLength(1);
  });

  it('IA não remarca para cima de um horário que a equipe marcou', async () => {
    const dia = proximoDiaUtil();
    const dados = daEmpresa(b, 'demo');
    const repo = new RepoBanco(b);
    const h = (hh: number) => instanteLocal(dia, hh * 60, FUSO).toISOString();
    const a1 = await marcarAgendamento(dados, { contatoId: 'ct-1', servicoId: 'sv-limpeza', profissionalId: 'pf-julia', inicio: h(10) }, { uid: 'demo-dono' });
    const a2 = await marcarAgendamento(dados, { contatoId: 'ct-2', servicoId: 'sv-limpeza', profissionalId: 'pf-julia', inicio: h(15) }, { uid: 'demo-dono' });
    expect(await repo.remarcarSeLivre('demo', a2.id, { inicio: a1.inicio, fim: a1.fim, profissionalId: 'pf-julia' })).toBe(false);
    expect(await repo.remarcarSeLivre('demo', a2.id, { inicio: h(16), fim: instanteLocal(dia, 17 * 60, FUSO).toISOString(), profissionalId: 'pf-julia' })).toBe(true);
    // e a equipe também não remarca por cima do que a IA deixou
    await expect(remarcarAgendamento(dados, a1.id, { inicio: h(16) }, { uid: 'demo-dono' })).rejects.toMatchObject({ status: 409 });
  });

  it('a trava é por empresa e profissional e solta mesmo com erro', async () => {
    expect(caminhoTravaAgenda('demo', 'pf/x')).toBe('empresas/demo/agenda_travas/pf_x');
    await expect(travaLocal.comTrava('t', async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(await travaLocal.comTrava('t', async () => 7)).toBe(7);
  });
});
