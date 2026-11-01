import { describe, expect, it } from 'vitest';
import * as api from '../../lib/estudio/api';
import { RepositorioMemoria } from '../../lib/estudio/repositorio';
import { simularImagens, videoSimulado } from '../../lib/integracoes/imagem';
import { lerRespostaLegenda } from '../../lib/estudio/legenda';
import { simularResposta } from '../../lib/estudio/texto-ia';
import type { Dependencias } from '../../lib/estudio/servico';

const FOTO = 'data:image/jpeg;base64,AAAA';
const emp = { nome: 'Topetes', segmento: 'Barbearia', marca: { cores: { primaria: '#112233' }, tom: 'descontraído' } };
const e1 = { empresaId: 'e1', uid: 'u1' };
const e2 = { empresaId: 'e2', uid: 'u2' };

function deps(): Dependencias {
  let n = 0;
  return {
    repo: new RepositorioMemoria({ e1: 50, e2: 50 }),
    gerarImagens: async (p) => simularImagens(p),
    iniciarVideo: async () => ({ operacao: 'simulado/9:16/1' }),
    consultarVideo: async () => ({ pronto: true, url: videoSimulado('9:16') }),
    gerarTextoPost: async (p) => lerRespostaLegenda(simularResposta(p)),
    agora: () => '2026-11-01T12:00:00Z',
    novoId: () => `id${++n}`,
  };
}
const corpo = (r: api.Resposta) => r.corpo as any;

describe('api do Estúdio', () => {
  it('kit: usa o onboarding e valida ao salvar', async () => {
    const d = deps();
    expect(corpo(await api.obterKit(d, e1, emp)).kit.cores.primaria).toBe('#112233');
    const ruim = await api.salvarKit(d, e1, { cores: { primaria: 'x', secundaria: '#fff' }, tom: 'ok ok' });
    expect(ruim.status).toBe(422);
    expect(corpo(ruim).campos.primaria).toBeTruthy();
    const bom = await api.salvarKit(d, e1, { cores: { primaria: '#abc', secundaria: '#fff' }, tom: 'próximo', fontes: { titulo: 'Poppins', texto: 'Inter' }, evitar: ['Cura'] });
    expect(bom.status).toBe(200);
    expect(corpo(await api.obterKit(d, e1, emp)).kit.evitar).toEqual(['cura']);
    // e2 não enxerga o kit da e1
    expect(corpo(await api.obterKit(d, e2, emp)).kit.fontes.titulo).not.toBe('Poppins');
  });

  it('foto: valida entrada', async () => {
    const d = deps();
    expect((await api.criarFoto(d, e1, emp, { estilo: 'x', formato: '1:1', fotos: [FOTO] })).status).toBe(422);
    expect((await api.criarFoto(d, e1, emp, { estilo: 'detalhe', formato: '1:1', fotos: [] })).status).toBe(422);
    expect((await api.criarFoto(d, e1, emp, { estilo: 'detalhe', formato: '1:1', fotos: ['http://x'] })).status).toBe(422);
    const r = await api.criarFoto(d, e1, emp, { estilo: 'detalhe', formato: '1:1', fotos: [FOTO], quantidade: 2 });
    expect(r.status).toBe(201);
    expect(corpo(r).saldo).toBe(46);
  });

  it('sem crédito responde 402', async () => {
    const d = deps();
    d.repo = new RepositorioMemoria({ e1: 1 });
    const r = await api.criarFoto(d, e1, emp, { estilo: 'detalhe', formato: '1:1', fotos: [FOTO], quantidade: 2 });
    expect(r.status).toBe(402);
    expect(corpo(r).falta).toBe(3);
  });

  it('post ligado a pauta marca a pauta como arte gerada', async () => {
    const d = deps();
    const s = await api.sugerirCalendario(d, e1, emp, { mes: '2026-11' });
    expect(s.status).toBe(201);
    const pauta = corpo(s).pautas[0];
    const r = await api.criarPost(d, e1, emp, { modelo: 'promocao', formato: '1:1', tema: pauta.tema, pautaId: pauta.id });
    expect(r.status).toBe(201);
    const lista = corpo(await api.listarCalendario(d, e1, '2026-11')).pautas;
    expect(lista.find((p: any) => p.id === pauta.id).status).toBe('arte-gerada');
    // outra empresa não usa a pauta da e1
    expect((await api.criarPost(d, e2, emp, { modelo: 'promocao', formato: '1:1', tema: 'x', pautaId: pauta.id })).status).toBe(404);
  });

  it('calendário: pede confirmação para substituir e mantém o que já tem arte', async () => {
    const d = deps();
    const p1 = corpo(await api.sugerirCalendario(d, e1, emp, { mes: '2026-11' })).pautas;
    expect((await api.sugerirCalendario(d, e1, emp, { mes: '2026-11' })).status).toBe(409);
    await api.criarPost(d, e1, emp, { modelo: 'novidade', formato: '1:1', tema: 't', pautaId: p1[1].id });
    const p2 = corpo(await api.sugerirCalendario(d, e1, emp, { mes: '2026-11', substituir: true, diasDaSemana: [1] })).pautas;
    expect(p2.some((p: any) => p.id === p1[1].id && p.status === 'arte-gerada')).toBe(true);
    expect(p2.filter((p: any) => p.status === 'rascunho').every((p: any) => !p1.some((o: any) => o.id === p.id))).toBe(true);
    expect((await api.listarCalendario(d, e1, '2026-13')).status).toBe(422);
  });

  it('editar pauta: status e isolamento', async () => {
    const d = deps();
    const p = corpo(await api.sugerirCalendario(d, e1, emp, { mes: '2026-12' })).pautas[0];
    expect(corpo(await api.editarPauta(d, e1, p.id, { status: 'publicado', tema: 'Novo tema' })).pauta).toMatchObject({ status: 'publicado', tema: 'Novo tema' });
    expect((await api.editarPauta(d, e2, p.id, { tema: 'hack' })).status).toBe(404);
  });

  it('galeria e criação isoladas por empresa', async () => {
    const d = deps();
    const c = corpo(await api.criarFoto(d, e1, emp, { estilo: 'detalhe', formato: '1:1', fotos: [FOTO], quantidade: 1 })).criacao;
    expect(corpo(await api.listarGaleria(d, e1, new URLSearchParams())).criacoes).toHaveLength(1);
    expect(corpo(await api.listarGaleria(d, e2, new URLSearchParams())).criacoes).toHaveLength(0);
    expect((await api.obterCriacao(d, e2, c.id)).status).toBe(404);
    expect((await api.apagarCriacao(d, e2, c.id)).status).toBe(404);
    expect((await api.editarPost(d, e2, c.id, { textos: { titulo: 'x' } })).status).toBe(400);
    expect((await api.consultarVideo(d, e2, c.id)).status).toBe(400);
    expect((await api.apagarCriacao(d, e1, c.id)).status).toBe(200);
  });

  it('vídeo e créditos', async () => {
    const d = deps();
    expect((await api.criarVideo(d, e1, { foto: FOTO, formato: '9:16', movimento: 'giro-suave', duracaoSeg: 10 })).status).toBe(422);
    const c = corpo(await api.criarVideo(d, e1, { foto: FOTO, formato: '9:16', movimento: 'giro-suave', duracaoSeg: 6 })).criacao;
    expect(corpo(await api.consultarVideo(d, e1, c.id)).criacao.status).toBe('pronta');
    const cr = corpo(await api.creditos(d, e1));
    expect(cr.saldo).toBe(40);
    expect(cr.extrato).toHaveLength(1);
    expect(corpo(await api.creditos(d, e2)).extrato).toHaveLength(0);
  });

  it('segmento livre vira segmento do calendário', () => {
    expect(api.segmentoDe('Barbearia')).toBe('barbearia');
    expect(api.segmentoDe('Clínica odontológica')).toBe('clinica');
    expect(api.segmentoDe('Salão de beleza')).toBe('estetica');
    expect(api.segmentoDe('xyz')).toBe('outro');
  });
});

import { RepositorioBanco } from '../../lib/estudio/repositorio-banco';
import { BancoMemoria } from '../../lib/dados/banco';
describe('repositório na Base', () => {
  it('saldo é o plano.creditos da empresa (o mesmo da cobrança) e cada empresa tem o seu', async () => {
    const b = new BancoMemoria();
    await b.gravar('empresas/demo-a', { id: 'demo-a', plano: { abas: ['estudio'], creditos: 30 } });
    await b.gravar('empresas/demo-b', { id: 'demo-b', plano: { abas: ['estudio'], creditos: 30 } });
    const r = new RepositorioBanco(b);
    expect(await r.saldo('demo-a')).toBe(30);
    await r.transacaoCreditos('demo-a', ({ saldo }) => ({ saldo: saldo - 2, lancamento: { id: 'x', empresaId: 'demo-a', tipo: 'debito', valor: 2, saldoDepois: saldo - 2, motivo: 'm', quando: 'q' }, resultado: null }));
    expect(await r.saldo('demo-a')).toBe(28);
    expect(await r.saldo('demo-b')).toBe(30);
    expect(((await b.obter('empresas/demo-a')) as { plano: { abas: string[] } }).plano.abas).toEqual(['estudio']);
    expect(await b.obter('empresas/demo-a/creditos/x')).toMatchObject({ origem: 'uso', quantidade: -2, saldoDepois: 28 });
    expect(await r.extrato('demo-b')).toEqual([]);
    await expect(r.transacaoCreditos('demo-a', ({ saldo }) => ({ saldo, lancamento: { id: 'y', empresaId: 'demo-b', tipo: 'debito', valor: 1, saldoDepois: saldo, motivo: 'm', quando: 'q' }, resultado: null }))).rejects.toThrow();
  });
});
