import { describe, expect, it } from 'vitest';
import { ETAPAS_PADRAO, agruparPorEtapa, filtrarContatos, idDeEtapa, linhaDoTempo, moverEtapa, validarEtapas, etiquetasUsadas } from '@/lib/contatos/funil';
import { importarContatosCsv, lerCsv, mapearColunas } from '@/lib/contatos/csv';
import type { Atividade, Contato } from '@/lib/tipos';

const agora = new Date('2026-11-01T12:00:00Z');
let n = 0;
const gerarId = () => `id${++n}`;

function contato(p: Partial<Contato>): Contato {
  return {
    id: 'c1',
    empresaId: 'e1',
    nome: 'Mariana Lopes',
    telefone: '5511999990001',
    origem: 'WhatsApp',
    etapa: 'novo',
    etiquetas: [],
    ultimaInteracaoEm: '2026-10-30T10:00:00Z',
    criadoEm: '2026-10-30T10:00:00Z',
    campos: {},
    ...p,
  };
}

describe('funil', () => {
  it('etapas padrão', () => {
    expect(ETAPAS_PADRAO.map((e) => e.nome)).toEqual(['Novo', 'Em conversa', 'Agendado', 'Compareceu', 'Cliente', 'Perdido']);
    expect(validarEtapas(ETAPAS_PADRAO)).toBeNull();
  });
  it('valida etapas configuradas', () => {
    expect(validarEtapas([{ id: 'a', nome: 'A' }])).toMatch(/2 etapas/);
    expect(validarEtapas([{ id: 'a', nome: 'A' }, { id: 'a', nome: 'B' }])).toMatch(/repetida/);
    expect(validarEtapas([{ id: 'a', nome: 'A' }, { id: 'B C', nome: 'B' }])).toMatch(/inválido/);
    expect(idDeEtapa('Em Negociação!')).toBe('em-negociacao');
  });
  it('agrupa por etapa e etapa desconhecida cai na primeira', () => {
    const g = agruparPorEtapa([contato({ id: '1', etapa: 'cliente' }), contato({ id: '2', etapa: 'sumiu' })], ETAPAS_PADRAO);
    expect(g.cliente.map((c) => c.id)).toEqual(['1']);
    expect(g.novo.map((c) => c.id)).toEqual(['2']);
    expect(Object.keys(g)).toHaveLength(6);
  });
  it('mover etapa gera atividade na linha do tempo', () => {
    const r = moverEtapa(contato({}), 'agendado', ETAPAS_PADRAO, { uid: 'u1' }, agora, gerarId);
    expect(r.contato.etapa).toBe('agendado');
    expect(r.contato.ultimaInteracaoEm).toBe(agora.toISOString());
    expect(r.atividade).toMatchObject({ tipo: 'etapa', resumo: 'Etapa: Novo → Agendado', porUid: 'u1', contatoId: 'c1' });
    expect(moverEtapa(contato({}), 'novo', ETAPAS_PADRAO, {}, agora, gerarId).atividade).toBeNull();
    expect(() => moverEtapa(contato({}), 'xx', ETAPAS_PADRAO, {}, agora, gerarId)).toThrow();
  });
  it('filtra por busca (sem acento, telefone), etapa e etiqueta', () => {
    const lista = [
      contato({ id: '1', nome: 'Júlia Mendes', telefone: '5511988887777', etiquetas: ['VIP'] }),
      contato({ id: '2', nome: 'Caio', etapa: 'cliente' }),
    ];
    expect(filtrarContatos(lista, { busca: 'julia' }).map((c) => c.id)).toEqual(['1']);
    expect(filtrarContatos(lista, { busca: '8888' }).map((c) => c.id)).toEqual(['1']);
    expect(filtrarContatos(lista, { etapa: 'cliente' }).map((c) => c.id)).toEqual(['2']);
    expect(filtrarContatos(lista, { etiqueta: 'VIP' }).map((c) => c.id)).toEqual(['1']);
    expect(etiquetasUsadas(lista)).toEqual(['VIP']);
  });
  it('linha do tempo: só do contato, mais recente primeiro', () => {
    const a: Atividade[] = [
      { id: '1', contatoId: 'c1', tipo: 'nota', resumo: 'a', quando: '2026-10-01T00:00:00Z' },
      { id: '2', contatoId: 'c1', tipo: 'mensagem', resumo: 'b', quando: '2026-10-02T00:00:00Z' },
      { id: '3', contatoId: 'c2', tipo: 'nota', resumo: 'c', quando: '2026-10-03T00:00:00Z' },
    ];
    expect(linhaDoTempo(a, 'c1').map((x) => x.id)).toEqual(['2', '1']);
  });
});

describe('CSV', () => {
  it('lê ponto e vírgula, aspas, quebra de linha e BOM', () => {
    const t = '﻿nome;telefone;obs\r\n"Silva; Ana";11999990001;"linha1\nlinha2"\r\nBruno;11 99999-0002;"diz ""oi"""\n';
    expect(lerCsv(t)).toEqual([
      ['nome', 'telefone', 'obs'],
      ['Silva; Ana', '11999990001', 'linha1\nlinha2'],
      ['Bruno', '11 99999-0002', 'diz "oi"'],
    ]);
  });
  it('mapeia colunas por sinônimos', () => {
    expect(mapearColunas(['Nome', 'WhatsApp', 'E-mail', 'Tags', 'Aniversário'])).toEqual(['nome', 'telefone', 'email', 'etiquetas', { extra: 'Aniversário' }]);
  });
  it('importa, deduplica e aponta erros por linha', () => {
    const csv = 'nome,celular,email,tags,aniversario\nAna,(11) 99999-0001,ANA@x.com,"VIP, Pacote",10/05\nBia,123,,,\nAna 2,11999990001,,,\nCida,11999990009,,,\n';
    const r = importarContatosCsv(csv, { empresaId: 'e1', existentes: [{ telefone: '5511999990009' }], etapaInicial: 'novo', agora, gerarId });
    expect(r.novos).toHaveLength(1);
    expect(r.novos[0]).toMatchObject({ nome: 'Ana', telefone: '5511999990001', email: 'ana@x.com', etiquetas: ['VIP', 'Pacote'], empresaId: 'e1', origem: 'Importação', campos: { aniversario: '10/05' } });
    expect(r.duplicados).toBe(2);
    expect(r.erros).toEqual([{ linha: 3, motivo: 'Telefone inválido: "123"' }]);
  });
  it('sem coluna de telefone ou vazio dá erro claro', () => {
    expect(importarContatosCsv('nome\nAna', { empresaId: 'e', existentes: [], etapaInicial: 'novo', agora, gerarId }).erros[0].motivo).toMatch(/telefone/);
    expect(importarContatosCsv('', { empresaId: 'e', existentes: [], etapaInicial: 'novo', agora, gerarId }).erros[0].motivo).toMatch(/vazio/);
  });
});
