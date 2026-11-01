import { describe, it, expect } from 'vitest';
import { placarPorVendedor, tendenciaSemanal, objecoesComuns, biblioteca, inicioDaSemana, etapasMaisEsquecidas, resumoInicio } from '../../lib/coach/placar';
import { atividadeDaReuniao, etapaSugerida, linkWaMe, normalizarTelefone, canalFollowup } from '../../lib/coach/contatos';
import type { Reuniao, Analise, Resultado } from '../../lib/coach/tipos';
import { CONFIG_PADRAO } from '../../lib/coach/tipos';

function an(nota: number, resultado: Resultado, extra: Partial<Analise> = {}): Analise {
  return {
    resumo: '', resultado, chanceFechar: 50, nota,
    etapas: [
      { etapaId: 'diagnostico', nome: 'Diagnóstico', status: 'nao_feita', comentario: '' },
      { etapaId: 'fechamento', nome: 'Fechamento', status: 'parcial', comentario: '' },
      { etapaId: 'conexao', nome: 'Conexão', status: 'feita', comentario: '' },
    ],
    diagnostico: { situacao: '', dores: [], objetivo: '', decisor: '', orcamento: '', urgencia: '' },
    objecoes: [{ objecao: 'Está caro', momentoSeg: null, bemRespondida: false, comoRespondeu: '', comoResponderMelhor: '' }],
    pontosFortes: [], melhorar: [], proximoPasso: { acao: '', data: null }, followup: '', fala: { vendedorPct: 60, clientePct: 40 }, geradoEm: '', ...extra,
  };
}
function reu(id: string, uid: string, criadoEm: string, analise?: Analise, extra: Partial<Reuniao> = {}): Reuniao {
  return { id, empresaId: 'e1', titulo: id, vendedorUid: uid, vendedorNome: uid.toUpperCase(), contatoId: null, modo: 'so-microfone', status: analise ? 'pronta' : 'gravando', semAudioDaAba: false, pedacos: [], duracaoSeg: 0, analise, naBiblioteca: false, criadoEm, atualizadoEm: criadoEm, ...extra };
}

const agora = '2026-11-01T15:00:00.000Z'; // domingo
const rs = [
  reu('1', 'ana', '2026-10-27T13:00:00.000Z', an(8, 'fechou')),
  reu('2', 'ana', '2026-10-28T13:00:00.000Z', an(6, 'pensando', { objecoes: [{ objecao: 'está caro!', momentoSeg: 3, bemRespondida: true, comoRespondeu: '', comoResponderMelhor: '' }] })),
  reu('3', 'bia', '2026-10-20T13:00:00.000Z', an(9, 'fechou')),
  reu('4', 'bia', '2026-10-29T13:00:00.000Z'),
];

describe('placar', () => {
  it('por vendedor', () => {
    const p = placarPorVendedor(rs);
    expect(p.map((l) => l.vendedorUid)).toEqual(['bia', 'ana']);
    const ana = p.find((l) => l.vendedorUid === 'ana')!;
    expect(ana).toMatchObject({ reunioes: 2, analisadas: 2, notaMedia: 7, taxaFechamento: 50, falaVendedorMedia: 60 });
    expect(ana.etapasEsquecidas[0]).toEqual({ etapaId: 'diagnostico', nome: 'Diagnóstico', vezes: 2 });
    const bia = p.find((l) => l.vendedorUid === 'bia')!;
    expect(bia).toMatchObject({ reunioes: 2, analisadas: 1, taxaFechamento: 100 });
  });
  it('sem reuniões analisadas → nulos', () => {
    expect(placarPorVendedor([reu('x', 'c', agora)])[0]).toMatchObject({ notaMedia: null, taxaFechamento: null });
  });
  it('etapas esquecidas: parcial vale meio', () => {
    expect(etapasMaisEsquecidas(rs).map((e) => [e.etapaId, e.vezes])).toEqual([['diagnostico', 3], ['fechamento', 1.5]]);
  });
  it('semana começa na segunda (fuso SP)', () => {
    expect(inicioDaSemana('2026-11-01T15:00:00.000Z')).toBe('2026-10-26');
    expect(inicioDaSemana('2026-11-02T02:00:00.000Z')).toBe('2026-10-26'); // ainda domingo em SP
    expect(inicioDaSemana('2026-11-02T04:00:00.000Z')).toBe('2026-11-02');
  });
  it('tendência semanal', () => {
    const t = tendenciaSemanal(rs, 2, agora);
    expect(t).toEqual([
      { semana: '2026-10-19', reunioes: 1, notaMedia: 9, taxaFechamento: 100 },
      { semana: '2026-10-26', reunioes: 3, notaMedia: 7, taxaFechamento: 50 },
    ]);
  });
  it('objeções da semana agrupadas', () => {
    expect(objecoesComuns(rs, agora)).toEqual([{ objecao: 'Está caro', vezes: 2, bemRespondidas: 1 }]);
  });
  it('biblioteca: marcada primeiro, depois nota ≥ 8', () => {
    const marcada = reu('5', 'ana', agora, an(5, 'retorno'), { naBiblioteca: true });
    expect(biblioteca([...rs, marcada]).map((r) => r.id)).toEqual(['5', '3', '1']);
  });
  it('resumo do Início', () => {
    expect(resumoInicio([...rs, reu('6', 'ana', agora)], agora)).toEqual({ reunioesHoje: 1, notaMediaSemana: 7, fechamentosSemana: 1 });
  });
});

describe('contatos e follow-up', () => {
  it('atividade só com contato', () => {
    expect(atividadeDaReuniao(rs[0])).toBeNull();
    const a = atividadeDaReuniao({ ...rs[0], contatoId: 'c1' })!;
    expect(a).toMatchObject({ contatoId: 'c1', tipo: 'reuniao', reuniaoId: '1' });
    expect(a.resumo).toContain('Fechou · nota 8.0');
  });
  it('etapa sugerida respeita a config', () => {
    expect(etapaSugerida('fechou', CONFIG_PADRAO)).toBeNull();
    const on = { ...CONFIG_PADRAO, moverEtapa: true };
    expect(etapaSugerida('fechou', on, 'Em conversa')).toBe('Cliente');
    expect(etapaSugerida('retorno', on, 'Em conversa')).toBeNull();
    expect(etapaSugerida('sem_interesse', on, 'Cliente')).toBeNull();
  });
  it('telefone e wa.me', () => {
    expect(normalizarTelefone('(11) 98888-7777')).toBe('5511988887777');
    expect(normalizarTelefone('5511988887777')).toBe('5511988887777');
    expect(normalizarTelefone('123')).toBeNull();
    expect(linkWaMe('11 98888-7777', 'oi tudo bem?')).toBe('https://wa.me/5511988887777?text=oi%20tudo%20bem%3F');
  });
  it('canal do follow-up', () => {
    expect(canalFollowup({ abas: ['coach'], whatsappConectado: true })).toBe('wa.me');
    expect(canalFollowup({ abas: ['coach', 'atendimento'], whatsappConectado: false })).toBe('wa.me');
    expect(canalFollowup({ abas: ['atendimento'], whatsappConectado: true })).toBe('whatsapp-empresa');
  });
});
