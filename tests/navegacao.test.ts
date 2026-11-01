import { describe, expect, it } from 'vitest';
import { NAVEGACAO, itemAtivo, navegacaoDoPlano } from '@/lib/navegacao';
import { formatarReais, formatarTelefone, iniciais, normalizarBusca, normalizarTelefone, tempoRelativo } from '@/lib/ui/formato';

describe('navegação', () => {
  it('tem as abas na ordem do design', () => {
    expect(NAVEGACAO.map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Contatos', 'Agenda', 'Coach', 'Estúdio', 'Configurações']);
  });
  it('acha o item ativo por prefixo', () => {
    expect(itemAtivo('/contatos/ct-1')?.id).toBe('contatos');
    expect(itemAtivo('/atendimento/treinar')?.id).toBe('atendimento');
    expect(itemAtivo('/contatosx')).toBeUndefined();
  });
  it('bloqueia abas fora do plano', () => {
    const n = navegacaoDoPlano(['atendimento']);
    expect(n.find((i) => i.id === 'coach')?.bloqueada).toBe(true);
    expect(n.find((i) => i.id === 'atendimento')?.bloqueada).toBe(false);
    expect(n.find((i) => i.id === 'contatos')?.bloqueada).toBe(false);
  });
});

describe('formatação', () => {
  it('iniciais', () => {
    expect(iniciais('Mariana Lopes da Silva')).toBe('MS');
    expect(iniciais('ana')).toBe('AN');
    expect(iniciais('  ')).toBe('?');
  });
  it('telefone', () => {
    expect(formatarTelefone('5511999998888')).toBe('(11) 99999-8888');
    expect(formatarTelefone('551133334444')).toBe('(11) 3333-4444');
    expect(normalizarTelefone('(11) 99999-8888')).toBe('5511999998888');
    expect(normalizarTelefone('+55 11 99999-8888')).toBe('5511999998888');
    expect(normalizarTelefone('011 99999-8888')).toBe('5511999998888');
    expect(normalizarTelefone('123')).toBeNull();
  });
  it('reais', () => {
    expect(formatarReais(1234.5)).toBe('R$ 1.234,50');
  });
  it('tempo relativo', () => {
    const agora = new Date('2026-11-01T12:00:00Z');
    expect(tempoRelativo('2026-11-01T11:59:30Z', agora)).toBe('agora');
    expect(tempoRelativo('2026-11-01T11:55:00Z', agora)).toBe('há 5 min');
    expect(tempoRelativo('2026-11-01T09:00:00Z', agora)).toBe('há 3 h');
    expect(tempoRelativo('2026-10-31T09:00:00Z', agora)).toBe('ontem');
    expect(tempoRelativo('2026-10-12T09:00:00Z', agora)).toBe('12/10');
  });
  it('busca sem acento', () => {
    expect(normalizarBusca('  Júlia ÇÃO ')).toBe('julia cao');
  });
});
