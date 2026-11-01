import { describe, it, expect, beforeEach } from 'vitest';
import * as S from '../../lib/coach/servico';
import { repositorioEmMemoria } from '../../lib/coach/repositorio';
import { transcricaoSimulada } from '../../lib/integracoes/gemini';
import { analiseSimulada } from '../../lib/coach/analise';
import type { Sessao } from '../../lib/coach/tipos';

const dono1: Sessao = { uid: 'd1', empresaId: 'e1', papel: 'dono', nome: 'Dono' };
const vend1: Sessao = { uid: 'v1', empresaId: 'e1', papel: 'vendedor', nome: 'Ana' };
const vend1b: Sessao = { uid: 'v2', empresaId: 'e1', papel: 'vendedor', nome: 'Bia' };
const aten1: Sessao = { uid: 'a1', empresaId: 'e1', papel: 'atendente' };
const dono2: Sessao = { uid: 'd2', empresaId: 'e2', papel: 'dono' };

const transcrever: S.Transcrever = async (_a, _m, p) => transcricaoSimulada(p);
const deps: S.DepsAnalise = { analisar: async (e) => analiseSimulada(e) };
const audio = new Uint8Array([1, 2, 3]);
let repo: ReturnType<typeof repositorioEmMemoria>;
beforeEach(() => { repo = repositorioEmMemoria(); });

async function reuniaoGravada(s = vend1, id = 'r1') {
  await S.criarReuniao(s, repo, { modo: 'duas-trilhas', contatoId: 'c1', contatoNome: 'Carlos', contatoTelefone: '11988887777' }, id);
  await S.receberPedaco(s, repo, id, { trilha: 'vendedor', indice: 0, audio, mime: 'audio/webm' }, transcrever);
  await S.receberPedaco(s, repo, id, { trilha: 'cliente', indice: 0, audio, mime: 'audio/webm' }, transcrever);
  return id;
}

describe('fluxo completo', () => {
  it('grava em pedaços, junta, analisa e prepara follow-up', async () => {
    await reuniaoGravada();
    await S.receberPedaco(vend1, repo, 'r1', { trilha: 'vendedor', indice: 1, audio, mime: 'audio/webm' }, transcrever);
    const { reuniao: antes } = await S.obterReuniao(vend1, repo, 'r1');
    expect(antes.pedacos).toHaveLength(3);
    expect(antes.duracaoSeg).toBe(600);

    const chamadas: string[] = [];
    await S.salvarConfig(dono1, repo, { moverEtapa: true });
    const { reuniao, falas, etapaNova } = await S.analisarReuniao(vend1, repo, 'r1', {
      ...deps,
      contatos: {
        registrarAtividade: async (e, a) => { chamadas.push(`atividade:${e}:${a.contatoId}`); },
        etapaAtual: async () => 'Novo',
        moverEtapa: async (e, c, et) => { chamadas.push(`mover:${e}:${c}:${et}`); },
      },
    });
    expect(reuniao.status).toBe('pronta');
    expect(falas.some((f) => f.inicioSeg >= 300)).toBe(true);
    expect(reuniao.analise!.fala.vendedorPct + reuniao.analise!.fala.clientePct).toBe(100);
    expect(chamadas[0]).toBe('atividade:e1:c1');
    expect(etapaNova).toBeTruthy();
    expect(chamadas[1]).toBe(`mover:e1:c1:${etapaNova}`);

    const f = await S.prepararFollowup(vend1, repo, 'r1', { abas: ['coach'], whatsappConectado: false });
    expect(f.canal).toBe('wa.me');
    expect(f.link).toMatch(/^https:\/\/wa\.me\/5511988887777\?text=/);
    const f2 = await S.prepararFollowup(vend1, repo, 'r1', { abas: ['atendimento', 'coach'], whatsappConectado: true, texto: 'Oi!' });
    expect(f2).toMatchObject({ canal: 'whatsapp-empresa', contatoId: 'c1', texto: 'Oi!' });
  });

  it('pedaço com erro não derruba a reunião', async () => {
    await S.criarReuniao(vend1, repo, { modo: 'so-microfone' }, 'r2');
    const { pedaco } = await S.receberPedaco(vend1, repo, 'r2', { trilha: 'misto', indice: 0, audio, mime: 'audio/webm' }, async () => { throw new Error('caiu'); });
    expect(pedaco.status).toBe('erro');
    await expect(S.analisarReuniao(vend1, repo, 'r2', deps)).rejects.toThrow(/Ainda não tem fala/);
  });

  it('falha da IA deixa status erro', async () => {
    await reuniaoGravada();
    const { reuniao } = await S.analisarReuniao(vend1, repo, 'r1', { analisar: async () => { throw new Error('timeout'); } });
    expect(reuniao.status).toBe('erro');
    expect(reuniao.erro).toMatch(/timeout/);
  });

  it('valida trilha e modo', async () => {
    await S.criarReuniao(vend1, repo, { modo: 'so-microfone' }, 'r3');
    await expect(S.receberPedaco(vend1, repo, 'r3', { trilha: 'cliente', indice: 0, audio, mime: 'a' }, transcrever)).rejects.toThrow(/Trilha/);
    await expect(S.criarReuniao(vend1, repo, { modo: 'arquivo' }, 'r4')).rejects.toThrow(/arquivo/);
    await expect(S.criarReuniao(vend1, repo, { modo: 'arquivo', arquivo: { nome: 'x.pdf', mime: 'application/pdf', bytes: 3 } }, 'r4')).rejects.toThrow(/Formato/);
  });

  it('arquivo enviado: sobe pro Gemini e transcreve uma janela por chamada', async () => {
    const r = await S.criarReuniao(vend1, repo, { modo: 'arquivo', arquivo: { nome: 'call 1.mp3', mime: 'audio/mpeg', bytes: 1000, duracaoSeg: 1500 } }, 'r5');
    expect(r.arquivo!.caminho).toBe('empresas/e1/reunioes/r5/arquivo-call_1.mp3');
    let envios = 0;
    const depsArq: S.DepsArquivo = {
      lerArquivo: async () => new Uint8Array([1]),
      enviarGemini: async () => { envios++; return { uri: 'g://1', mimeType: 'audio/mpeg' }; },
      transcreverJanela: async (_a, j, i) => transcricaoSimulada({ trilha: 'misto', indice: i, duracaoSeg: j.fimSeg - j.inicioSeg }).map((f) => ({ ...f, inicioSeg: f.inicioSeg + j.inicioSeg, fimSeg: f.fimSeg + j.inicioSeg })),
    };
    const passos = [];
    let p;
    do { p = await S.processarArquivo(vend1, repo, 'r5', depsArq, '2026-11-01T12:00:00.000Z'); passos.push(p.feitas); } while (!p.terminou);
    expect(envios).toBe(1);
    expect(passos).toEqual([0, 1, 2, 3]);
    expect(p.reuniao.pedacos).toHaveLength(3);
    // depois de 48 h reenvia
    await repo.atualizarReuniao('e1', 'r5', (x) => { x.arquivo!.janelasFeitas = 2; return x; });
    await S.processarArquivo(vend1, repo, 'r5', depsArq, '2026-11-03T12:00:00.000Z');
    expect(envios).toBe(2);
    const { reuniao } = await S.analisarReuniao(vend1, repo, 'r5', deps);
    expect(reuniao.status).toBe('pronta');
  });

  it('pedaço guarda o áudio no Storage da empresa', async () => {
    await S.criarReuniao(vend1, repo, { modo: 'so-microfone' }, 'r6');
    const guardados: string[] = [];
    const { pedaco } = await S.receberPedaco(vend1, repo, 'r6', { trilha: 'misto', indice: 2, audio, mime: 'audio/webm;codecs=opus' }, transcrever, undefined, async (c) => { guardados.push(c); });
    expect(guardados).toEqual(['empresas/e1/reunioes/r6/misto-002.webm']);
    expect(pedaco).toMatchObject({ caminhoAudio: guardados[0], inicioSeg: 600, mime: 'audio/webm' });
  });
});

describe('isolamento por empresa e papéis', () => {
  it('outra empresa não vê, não grava, não analisa e não lista', async () => {
    await reuniaoGravada();
    await expect(S.obterReuniao(dono2, repo, 'r1')).rejects.toMatchObject({ status: 404 });
    await expect(S.receberPedaco(dono2, repo, 'r1', { trilha: 'vendedor', indice: 2, audio, mime: 'a' }, transcrever)).rejects.toMatchObject({ status: 404 });
    await expect(S.analisarReuniao(dono2, repo, 'r1', deps)).rejects.toMatchObject({ status: 404 });
    await expect(S.prepararFollowup(dono2, repo, 'r1', { abas: [], whatsappConectado: false })).rejects.toMatchObject({ status: 404 });
    await expect(S.marcarBiblioteca(dono2, repo, 'r1', true)).rejects.toMatchObject({ status: 404 });
    expect(await S.listarReunioes(dono2, repo)).toEqual([]);
    const placar = await S.obterPlacar(dono2, repo);
    expect(placar.linhas).toEqual([]);
  });

  it('roteiro e config são por empresa', async () => {
    await S.salvarRoteiro(dono1, repo, { etapas: [{ nome: 'Única' }] });
    expect((await S.obterRoteiro(dono1, repo)).roteiro.etapas).toHaveLength(1);
    const outro = await S.obterRoteiro(dono2, repo, 'clinica');
    expect(outro.ehModelo).toBe(true);
    expect(outro.roteiro.etapas).toHaveLength(6);
    await S.salvarConfig(dono1, repo, { moverEtapa: true });
    expect((await S.obterConfig(dono2, repo)).moverEtapa).toBe(false);
  });

  it('vendedor só vê as próprias (e as da biblioteca)', async () => {
    await reuniaoGravada(vend1, 'r1');
    await reuniaoGravada(vend1b, 'r2');
    expect((await S.listarReunioes(vend1, repo)).map((r) => r.id)).toEqual(['r1']);
    expect((await S.listarReunioes(dono1, repo)).map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    await expect(S.obterReuniao(vend1, repo, 'r2')).rejects.toMatchObject({ status: 404 });
    await S.marcarBiblioteca(dono1, repo, 'r2', true);
    expect((await S.obterReuniao(vend1, repo, 'r2')).reuniao.id).toBe('r2');
    // pode ver, mas não mexer
    await expect(S.analisarReuniao(vend1, repo, 'r2', deps)).rejects.toMatchObject({ status: 403 });
  });

  it('vendedor não edita roteiro nem biblioteca; atendente não usa o Coach', async () => {
    await expect(S.salvarRoteiro(vend1, repo, { etapas: [{ nome: 'x' }] })).rejects.toMatchObject({ status: 403 });
    await reuniaoGravada();
    await expect(S.marcarBiblioteca(vend1, repo, 'r1', true)).rejects.toMatchObject({ status: 403 });
    await expect(S.listarReunioes(aten1, repo)).rejects.toMatchObject({ status: 403 });
  });

  it('placar do vendedor mostra só ele; do dono mostra todos', async () => {
    await reuniaoGravada(vend1, 'r1');
    await reuniaoGravada(vend1b, 'r2');
    await S.analisarReuniao(vend1, repo, 'r1', deps);
    await S.analisarReuniao(vend1b, repo, 'r2', deps);
    expect((await S.obterPlacar(vend1, repo)).linhas.map((l) => l.vendedorUid)).toEqual(['v1']);
    expect((await S.obterPlacar(dono1, repo)).linhas).toHaveLength(2);
  });
});
