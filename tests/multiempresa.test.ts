import { beforeEach, describe, expect, it } from 'vitest';
import { BancoMemoria, juntar, segmentoSeguro } from '@/lib/dados/banco';
import { daEmpresa } from '@/lib/dados/empresa';
import { podeAcessar, podeAlterarMembro, ESCRITA_POR_COLECAO } from '@/lib/auth/permissoes';
import { exigirEmpresa, lerTokenSimulado, resolverSessao, lerBearer } from '@/lib/auth/servidor';
import { aceitarConvitePendente, convidar, criarEmpresa } from '@/lib/base/empresas';
import { ErroHttp } from '@/lib/auth/erros';
import { COLECOES, type Membro } from '@/lib/tipos';

function req(token?: string, empresa?: string) {
  const h: Record<string, string> = {};
  if (token) h.authorization = `Bearer ${token}`;
  if (empresa) h['x-empresa-id'] = empresa;
  return new Request('http://x/api', { headers: h });
}

describe('banco e escopo por empresa', () => {
  it('não deixa caminho escapar da empresa', () => {
    expect(() => segmentoSeguro('../outra')).toThrow();
    expect(() => segmentoSeguro('a/b')).toThrow();
    expect(() => segmentoSeguro('')).toThrow();
    expect(() => segmentoSeguro('..')).toThrow();
    expect(segmentoSeguro('ana@x.com')).toBe('ana@x.com');
    const b = new BancoMemoria();
    expect(() => daEmpresa(b, 'e1').obter('contatos', '../../e2/contatos/c1')).toThrow();
  });

  it('empresa A não lista nem lê dados da empresa B', async () => {
    const b = new BancoMemoria();
    const a = daEmpresa(b, 'A');
    const bb = daEmpresa(b, 'B');
    await a.gravar('contatos', 'c1', { id: 'c1', nome: 'da A' });
    await bb.gravar('contatos', 'c2', { id: 'c2', nome: 'da B' });
    expect((await a.listar<{ id: string }>('contatos')).map((c) => c.id)).toEqual(['c1']);
    expect(await a.obter('contatos', 'c2')).toBeNull();
    // subcoleções não vazam para a listagem do pai
    await b.gravar('empresas/A/contatos/c1/extra/x', { id: 'x' });
    expect(await a.listar('contatos')).toHaveLength(1);
  });

  it('mesclarEmpresa não troca o id', async () => {
    const b = new BancoMemoria();
    await b.gravar('empresas/A', { id: 'A', nome: 'x' });
    await daEmpresa(b, 'A').mesclarEmpresa({ id: 'B', nome: 'y' } as never);
    expect(await b.obter('empresas/A')).toEqual({ id: 'A', nome: 'y' });
  });
});

describe('permissões (espelho do firestore.rules)', () => {
  const m = (papel: Membro['papel'], ativo = true) => ({ papel, ativo });
  it('ler: qualquer membro ativo; inativo ou de fora não', () => {
    expect(podeAcessar(m('vendedor'), 'contatos', 'ler')).toBe(true);
    expect(podeAcessar(m('dono', false), 'contatos', 'ler')).toBe(false);
    expect(podeAcessar(null, 'contatos', 'ler')).toBe(false);
  });
  it('escrever depende do papel', () => {
    expect(podeAcessar(m('atendente'), 'membros', 'escrever')).toBe(false);
    expect(podeAcessar(m('gestor'), 'membros', 'escrever')).toBe(true);
    expect(podeAcessar(m('atendente'), 'conversas', 'escrever')).toBe(true);
    expect(podeAcessar(m('vendedor'), 'conversas', 'escrever')).toBe(false);
    expect(podeAcessar(m('vendedor'), 'reunioes', 'escrever')).toBe(true);
    expect(podeAcessar(m('atendente'), 'empresa', 'escrever')).toBe(false);
  });
  it('toda coleção tem regra', () => {
    for (const c of COLECOES) expect(ESCRITA_POR_COLECAO[c]).toBeDefined();
  });
  it('a empresa sempre fica com um dono', () => {
    const todos = [
      { uid: 'd', papel: 'dono' as const, ativo: true },
      { uid: 'g', papel: 'gestor' as const, ativo: true },
    ];
    expect(podeAlterarMembro('dono', todos[0], todos, 'gestor').ok).toBe(false);
    expect(podeAlterarMembro('gestor', todos[0], todos, 'gestor').ok).toBe(false);
    expect(podeAlterarMembro('gestor', todos[1], todos, 'dono').ok).toBe(false);
    expect(podeAlterarMembro('dono', todos[1], todos, 'dono').ok).toBe(true);
    expect(podeAlterarMembro('atendente', todos[1], todos, 'vendedor').ok).toBe(false);
  });
});

describe('autenticação no servidor', () => {
  it('lê bearer e token simulado', () => {
    expect(lerBearer(req('abc'))).toBe('abc');
    expect(lerBearer(req())).toBeNull();
    expect(lerTokenSimulado('simulado:u1:Ana@X.com')).toEqual({ uid: 'u1', email: 'ana@x.com' });
    expect(lerTokenSimulado('simulado:u1')).toBeNull();
    expect(lerTokenSimulado('eyJhbGciOi...')).toBeNull();
  });

  it('resolverSessao: só com membro ativo da empresa pedida', () => {
    const id = { uid: 'u1', email: 'a@x.com' };
    const usuario = { uid: 'u1', email: 'a@x.com', nome: 'A', empresaAtual: 'A', empresas: ['A'] };
    const membro: Membro = { uid: 'u1', email: 'a@x.com', nome: 'A', papel: 'gestor', ativo: true };
    expect(resolverSessao(id, usuario, null, membro)).toEqual({ uid: 'u1', email: 'a@x.com', empresaId: 'A', papel: 'gestor' });
    expect(resolverSessao(id, usuario, 'B', membro)).toBeNull(); // pediu empresa que não é dele
    expect(resolverSessao(id, usuario, null, { ...membro, ativo: false })).toBeNull();
    expect(resolverSessao(id, usuario, null, null)).toBeNull();
    expect(resolverSessao(id, null, null, membro)).toBeNull();
  });

  describe('exigirEmpresa', () => {
    let b: BancoMemoria;
    beforeEach(async () => {
      b = new BancoMemoria();
      await criarEmpresa(b, { uid: 'dono', email: 'dono@a.com' }, { nome: 'A' });
      await criarEmpresa(b, { uid: 'outro', email: 'outro@b.com' }, { nome: 'B' });
    });
    const ctx = () => ({ banco: b, simulado: true });

    it('devolve uid, email, empresaId e papel', async () => {
      const s = await exigirEmpresa(req('simulado:dono:dono@a.com'), undefined, ctx());
      expect(s).toMatchObject({ uid: 'dono', email: 'dono@a.com', papel: 'dono' });
      expect(s.empresaId).toMatch(/^emp_/);
    });

    it('401 sem token ou token inválido; token simulado não vale fora do modo simulado', async () => {
      await expect(exigirEmpresa(req(), undefined, ctx())).rejects.toMatchObject({ status: 401 });
      await expect(exigirEmpresa(req('lixo'), undefined, ctx())).rejects.toMatchObject({ status: 401 });
    });

    it('403 quando tenta usar a empresa de outro pelo header', async () => {
      const sB = await exigirEmpresa(req('simulado:outro:outro@b.com'), undefined, ctx());
      await expect(exigirEmpresa(req('simulado:dono:dono@a.com', sB.empresaId), undefined, ctx())).rejects.toBeInstanceOf(ErroHttp);
    });

    it('403 quando o papel não é permitido', async () => {
      const s = await exigirEmpresa(req('simulado:dono:dono@a.com'), undefined, ctx());
      await convidar(b, s.empresaId, 'ana@a.com', 'atendente', 'dono');
      expect(await aceitarConvitePendente(b, { uid: 'ana', email: 'ana@a.com' })).toBe(s.empresaId);
      const ana = await exigirEmpresa(req('simulado:ana:ana@a.com'), ['dono', 'gestor', 'atendente'], ctx());
      expect(ana.papel).toBe('atendente');
      await expect(exigirEmpresa(req('simulado:ana:ana@a.com'), ['dono', 'gestor'], ctx())).rejects.toMatchObject({ status: 403 });
      // convite foi consumido
      expect(await b.obter(juntar('convites', 'ana@a.com'))).toBeNull();
    });
  });
});
