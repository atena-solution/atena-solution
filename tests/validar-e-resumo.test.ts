import { describe, expect, it } from 'vitest';
import { validarAgendamento, validarContato, validarEmpresa, validarHorarios, validarProfissional, validarServico } from '@/lib/base/validar';
import { resumoDoDia, saudacao } from '@/lib/inicio/resumo';
import { etapaAposAgenda, ETAPAS_PADRAO } from '@/lib/contatos/funil';
import { montarEmpresa } from '@/lib/base/empresas';
import type { Agendamento } from '@/lib/tipos';

describe('validação', () => {
  it('empresa: campos obrigatórios e telefone', () => {
    const r = validarEmpresa({ nome: 'A', segmento: '', telefone: '123', horarios: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['nome', 'segmento', 'telefone']);
    const ok = validarEmpresa({ nome: 'Barbearia', segmento: 'Barbearia', telefone: '(11) 98888-7777', horarios: [{ dia: 1, abre: '09:00', fecha: '18:00' }] });
    expect(ok).toMatchObject({ ok: true, valor: { telefone: '5511988887777' } });
  });
  it('empresa parcial só valida o que veio', () => {
    expect(validarEmpresa({ nome: 'Novo' }, true)).toEqual({ ok: true, valor: { nome: 'Novo' } });
  });
  it('marca: cor e logo', () => {
    expect(validarEmpresa({ marca: { cores: { primaria: 'azul' } } }, true).ok).toBe(false);
    expect(validarEmpresa({ marca: { logoUrl: 'javascript:alert(1)' } }, true).ok).toBe(false);
    expect(validarEmpresa({ marca: { logoUrl: 'https://x.com/l.png', cores: { primaria: '#112233', secundaria: '#445566' }, tom: 'leve' } }, true).ok).toBe(true);
  });
  it('horários', () => {
    expect(validarHorarios([{ dia: 7, abre: '09:00', fecha: '10:00' }]).ok).toBe(false);
    expect(validarHorarios([{ dia: 1, abre: '9h', fecha: '10:00' }]).ok).toBe(false);
    expect(validarHorarios([{ dia: 1, abre: '10:00', fecha: '09:00' }]).ok).toBe(false);
    expect(validarHorarios('x').ok).toBe(false);
  });
  it('serviço e profissional', () => {
    expect(validarServico({ nome: 'Corte', duracaoMin: 30, preco: '49.999' })).toMatchObject({ ok: true, valor: { preco: 50 } });
    expect(validarServico({ nome: '', duracaoMin: 2, preco: -1 }).ok).toBe(false);
    expect(validarProfissional({ nome: 'Júlia', servicosIds: ['a', 3], horarios: [] })).toMatchObject({ ok: true, valor: { servicosIds: ['a'] } });
  });
  it('contato limpa etiquetas e e-mail', () => {
    const r = validarContato({ nome: ' Ana ', telefone: '11 99999-0000', email: 'ANA@X.COM', etiquetas: ['VIP', 'VIP', ' ', 'Novo'] });
    expect(r).toMatchObject({ ok: true, valor: { nome: 'Ana', telefone: '5511999990000', email: 'ana@x.com', etiquetas: ['VIP', 'Novo'], origem: 'Manual' } });
    expect(validarContato({ email: 'x' }, true).ok).toBe(false);
  });
  it('agendamento', () => {
    expect(validarAgendamento({}).ok).toBe(false);
    expect(validarAgendamento({ contatoId: 'c', servicoId: 's', profissionalId: 'p', inicio: '2026-11-02T12:00:00Z' })).toMatchObject({ ok: true, valor: { inicio: '2026-11-02T12:00:00.000Z' } });
  });
});

describe('início', () => {
  const ag = (id: string, inicio: string, status: Agendamento['status']): Agendamento => ({
    id, contatoId: 'c', servicoId: 's', profissionalId: 'p', inicio, fim: new Date(new Date(inicio).getTime() + 1800000).toISOString(), status, criadoPor: 'ia', lembretes: {},
  });
  it('conta o dia local da empresa', () => {
    const agora = new Date('2026-11-02T15:00:00Z'); // 12:00 em SP
    const r = resumoDoDia({
      agora,
      fuso: 'America/Sao_Paulo',
      agendamentos: [
        ag('1', '2026-11-02T12:00:00Z', 'compareceu'),
        ag('2', '2026-11-02T17:00:00Z', 'confirmado'),
        ag('3', '2026-11-02T13:00:00Z', 'faltou'),
        ag('4', '2026-11-02T18:00:00Z', 'cancelado'),
        ag('5', '2026-11-03T02:30:00Z', 'marcado'), // 23:30 do dia 02 em SP
        ag('6', '2026-11-03T12:00:00Z', 'marcado'),
      ],
      contatos: [{ criadoEm: '2026-11-02T10:00:00Z' }, { criadoEm: '2026-11-02T02:00:00Z' }],
      conversas: [{ status: 'aberta' }, { status: 'humano', precisaHumano: true }, { status: 'resolvida' }],
    });
    expect(r).toMatchObject({ agendamentosHoje: 4, confirmadosHoje: 1, compareceramHoje: 1, faltasHoje: 1, novosContatosHoje: 1, conversasAbertas: 2, precisamDeHumano: 1 });
    expect(r.proximos.map((a) => a.id)).toEqual(['2', '5']);
  });
  it('saudação pelo horário local', () => {
    expect(saudacao(new Date('2026-11-02T11:00:00Z'), 'America/Sao_Paulo')).toBe('Bom dia');
    expect(saudacao(new Date('2026-11-02T18:00:00Z'), 'America/Sao_Paulo')).toBe('Boa tarde');
    expect(saudacao(new Date('2026-11-02T23:00:00Z'), 'America/Sao_Paulo')).toBe('Boa noite');
  });
});

describe('funil x agenda', () => {
  it('marcar leva para Agendado; comparecer leva para Compareceu; nunca volta Cliente', () => {
    expect(etapaAposAgenda('novo', 'marcou', ETAPAS_PADRAO)).toBe('agendado');
    expect(etapaAposAgenda('agendado', 'compareceu', ETAPAS_PADRAO)).toBe('compareceu');
    expect(etapaAposAgenda('cliente', 'marcou', ETAPAS_PADRAO)).toBeNull();
    expect(etapaAposAgenda('perdido', 'marcou', ETAPAS_PADRAO)).toBe('agendado');
    expect(etapaAposAgenda('novo', 'marcou', [{ id: 'a', nome: 'A' }, { id: 'b', nome: 'B' }])).toBeNull();
  });
  it('empresa nova vem com padrões', () => {
    const e = montarEmpresa('x', { nome: 'X' }, new Date('2026-11-01T00:00:00Z'));
    expect(e).toMatchObject({ id: 'x', fuso: 'America/Sao_Paulo', onboardingConcluido: false });
    expect(e.etapas).toHaveLength(6);
    expect(e.horarios.length).toBeGreaterThan(0);
  });
});
