import { describe, it, expect, beforeEach } from 'vitest';
import { caminhoDaEmpresa, armazenamentoEmMemoria, urlSimulada, conferirUrlSimulada } from '../../lib/coach/armazenamento';
import { autenticar, responder } from '../../lib/coach/servidor';
import { ErroCoach } from '../../lib/coach/servico';
import { BancoMemoria } from '../../lib/dados/banco';
import { semearDemo } from '../../lib/dados/demo';

beforeEach(() => { process.env.SIMULAR = '1'; });

describe('armazenamento', () => {
  it('caminho só vale dentro da empresa', () => {
    expect(caminhoDaEmpresa('empresas/e1/reunioes/r1/a.webm', 'e1')).toBe(true);
    expect(caminhoDaEmpresa('empresas/e2/reunioes/r1/a.webm', 'e1')).toBe(false);
    expect(caminhoDaEmpresa('empresas/e1/reunioes/../../e2/x', 'e1')).toBe(false);
    expect(caminhoDaEmpresa('empresas/e1x/reunioes/r', 'e1')).toBe(false);
    expect(caminhoDaEmpresa('empresas//reunioes/r', '')).toBe(false);
  });
  it('memória salva e lê', async () => {
    const a = armazenamentoEmMemoria();
    await a.salvar('empresas/e1/reunioes/r/x', new Uint8Array([1]), 'audio/webm');
    expect(await a.ler('empresas/e1/reunioes/r/x')).toEqual(new Uint8Array([1]));
    await expect(a.ler('nada')).rejects.toThrow();
    expect((await a.urlEnvio('empresas/e1/reunioes/r/x', 'audio/mpeg')).cabecalhos['Content-Type']).toBe('audio/mpeg');
  });
});

describe('URL assinada do modo simulado', () => {
  const sp = (u: string) => new URL(u, 'http://x').searchParams;
  it('vale só pro caminho, ação e prazo assinados', () => {
    const u = urlSimulada('empresas/e1/reunioes/r/a.webm', 'ler', 1000, 'k');
    expect(conferirUrlSimulada(sp(u), 'ler', 2000, 'k')).toBe('empresas/e1/reunioes/r/a.webm');
    expect(conferirUrlSimulada(sp(u), 'enviar', 2000, 'k')).toBeNull();
    expect(conferirUrlSimulada(sp(u), 'ler', 1000 + 3 * 3600 * 1000, 'k')).toBeNull();
    expect(conferirUrlSimulada(sp(u.replace('e1', 'e2')), 'ler', 2000, 'k')).toBeNull();
    expect(conferirUrlSimulada(sp(u), 'ler', 2000, 'outro')).toBeNull();
  });
});

describe('servidor', () => {
  const ctx = async () => {
    const b = new BancoMemoria();
    await semearDemo(b);
    return { banco: b, simulado: true };
  };
  const req = (token?: string) => new Request('http://x', { headers: token ? { authorization: `Bearer ${token}` } : {} });
  it('usa o login da Base: papel e nome vêm do membro da empresa', async () => {
    const c = await ctx();
    expect(await autenticar(req('simulado:demo-bruno:bruno@demo.atena'), c)).toMatchObject({ uid: 'demo-bruno', empresaId: 'demo', papel: 'vendedor', nome: 'Bruno Lima' });
    expect(await autenticar(req('simulado:demo-dono:dono@demo.atena'), c)).toMatchObject({ papel: 'dono', empresaId: 'demo' });
    expect(await autenticar(req('simulado:demo-outro:outro@demo.atena'), c)).toMatchObject({ empresaId: 'demo-outra' });
  });
  it('sem login → 401; atendente não usa o Coach → 403; não entra em empresa alheia', async () => {
    const c = await ctx();
    await expect(autenticar(req(), c)).rejects.toMatchObject({ status: 401 });
    await expect(autenticar(req('simulado:demo-ana:ana@demo.atena'), c)).rejects.toMatchObject({ status: 403 });
    const alheia = new Request('http://x', { headers: { authorization: 'Bearer simulado:demo-outro:outro@demo.atena', 'x-empresa-id': 'demo' } });
    await expect(autenticar(alheia, c)).rejects.toMatchObject({ status: 403 });
  });
  it('responder converte erros', async () => {
    const r = await responder(async () => { throw new ErroCoach(404, 'Reunião não encontrada.'); });
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ erro: 'Reunião não encontrada.' });
    const r2 = await responder(async () => { throw new Error('segredo interno'); });
    expect(r2.status).toBe(500);
    expect(JSON.stringify(await r2.json())).not.toContain('segredo');
    expect(await (await responder(async () => ({ a: 1 }))).json()).toEqual({ a: 1 });
  });
});
