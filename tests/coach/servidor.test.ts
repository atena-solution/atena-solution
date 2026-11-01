import { describe, it, expect, beforeEach } from 'vitest';
import { caminhoDaEmpresa, armazenamentoEmMemoria } from '../../lib/coach/armazenamento';
import { autenticar, responder } from '../../lib/coach/servidor';
import { ErroCoach } from '../../lib/coach/servico';

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

describe('servidor', () => {
  it('sessão simulada aceita papel válido e ignora inválido', async () => {
    const s = await autenticar(new Request('http://x', { headers: { 'x-sim-papel': 'vendedor', 'x-sim-empresa': 'e9' } }));
    expect(s).toMatchObject({ papel: 'vendedor', empresaId: 'e9' });
    expect((await autenticar(new Request('http://x', { headers: { 'x-sim-papel': 'admin' } }))).papel).toBe('dono');
  });
  it('sem SIMULAR exige login da Base', async () => {
    process.env.SIMULAR = '0';
    await expect(autenticar(new Request('http://x'))).rejects.toMatchObject({ status: 501 });
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
