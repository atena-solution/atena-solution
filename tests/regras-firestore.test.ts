import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESCRITA_POR_COLECAO } from '@/lib/auth/permissoes';
import { COLECOES } from '@/lib/tipos';
import { REGRAS_EMPRESA, SO_SERVIDOR_TOPO, gerarFirestoreRules, gerarIndices, gerarStorageRules, podeEscreverDoc, podeLerDoc } from '@/lib/auth/regras-dados';

/**
 * Sem emulador na nuvem: as regras são GERADAS da tabela (lib/auth/regras-dados.ts) e conferimos
 * (1) que os arquivos estão iguais ao gerado, (2) a decisão pura, (3) que toda coleção usada no código está na tabela.
 * Teste das regras no emulador: `firebase emulators:exec` — fazer no Mac.
 * Para regenerar os arquivos: npm run regras
 */
const raiz = new URL('..', import.meta.url).pathname;
const ARQUIVOS: [string, () => string][] = [
  ['firestore.rules', gerarFirestoreRules],
  ['storage.rules', gerarStorageRules],
  ['firestore.indexes.json', () => JSON.stringify(gerarIndices(), null, 2) + '\n'],
];
if (process.env.ATUALIZAR_REGRAS === '1') for (const [n, g] of ARQUIVOS) writeFileSync(join(raiz, n), g());
const regras = readFileSync(join(raiz, 'firestore.rules'), 'utf8');

describe('arquivos de regras', () => {
  for (const [nome, gerar] of ARQUIVOS) {
    it(`${nome} igual ao gerado da tabela (rode npm run regras se mudou a tabela)`, () => {
      expect(readFileSync(join(raiz, nome), 'utf8')).toBe(gerar());
    });
  }
  it('firebase.json aponta para as regras do Firestore e do Storage', () => {
    const f = JSON.parse(readFileSync(join(raiz, 'firebase.json'), 'utf8'));
    expect(f.firestore).toMatchObject({ rules: 'firestore.rules', indexes: 'firestore.indexes.json' });
    expect(f.storage).toMatchObject({ rules: 'storage.rules' });
  });
  it('escrita das coleções da Base igual a permissoes.ts', () => {
    for (const c of COLECOES) expect(REGRAS_EMPRESA[c]?.escrever, c).toEqual(ESCRITA_POR_COLECAO[c]);
  });
  it('empresa: update só dono/gestor e sem mexer no plano', () => {
    expect(regras).toMatch(/allow update: if papelEm\(empresaId, \['dono', 'gestor'\]\)/);
    expect(regras).toMatch(/request\.resource\.data\.plano == resource\.data\.plano/);
  });
  it('nada aberto para quem não está logado; o resto é negado', () => {
    expect(regras).not.toMatch(/allow (read|write)[^;]*: if true/);
    expect(regras).toMatch(/match \/\{outra\}\/\{id=\*\*\} \{\s+allow read, write: if false;/);
    expect(gerarStorageRules()).not.toMatch(/if true/);
  });
});

describe('decisão pura (espelho das regras)', () => {
  const m = (papel: 'dono' | 'gestor' | 'atendente' | 'vendedor', ativo = true) => ({ uid: `u-${papel}`, papel, ativo });
  it('vendedor vê só as próprias reuniões e as da biblioteca; atendente não vê', () => {
    const r = REGRAS_EMPRESA.reunioes;
    expect(podeLerDoc(r, m('dono'), { vendedorUid: 'x' })).toBe(true);
    expect(podeLerDoc(r, m('vendedor'), { vendedorUid: 'u-vendedor' })).toBe(true);
    expect(podeLerDoc(r, m('vendedor'), { vendedorUid: 'x', naBiblioteca: true })).toBe(true);
    expect(podeLerDoc(r, m('vendedor'), { vendedorUid: 'x', naBiblioteca: false })).toBe(false);
    expect(podeLerDoc(r, m('atendente'), { vendedorUid: 'u-atendente' })).toBe(false);
  });
  it('segredos internos ninguém lê nem escreve pelo navegador', () => {
    for (const c of ['uso', 'atendimento_push', 'atendimento_recebidos', 'agenda_travas']) {
      expect(podeLerDoc(REGRAS_EMPRESA[c], m('dono'))).toBe(false);
      expect(podeEscreverDoc(REGRAS_EMPRESA[c], m('dono'))).toBe(false);
    }
    for (const c of ['segredos', 'whatsappNumeros', 'filaAtendimento']) expect(SO_SERVIDOR_TOPO).toContain(c);
  });
  it('cobrança só dono/gestor leem; créditos e Estúdio só o servidor escreve', () => {
    expect(podeLerDoc(REGRAS_EMPRESA.cobranca, m('gestor'))).toBe(true);
    expect(podeLerDoc(REGRAS_EMPRESA.cobranca, m('atendente'))).toBe(false);
    expect(podeEscreverDoc(REGRAS_EMPRESA.creditos, m('dono'))).toBe(false);
    expect(podeLerDoc(REGRAS_EMPRESA.creditos, m('vendedor'))).toBe(true);
  });
  it('membro inativo ou sem cadastro não acessa nada', () => {
    expect(podeLerDoc(REGRAS_EMPRESA.contatos, m('dono', false))).toBe(false);
    expect(podeLerDoc(REGRAS_EMPRESA.contatos, null)).toBe(false);
    expect(podeLerDoc(undefined, m('dono'))).toBe(false);
  });
});

describe('toda coleção usada no código tem regra', () => {
  function arquivos(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? (n === 'node_modules' ? [] : arquivos(p)) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  }
  const fonte = [...arquivos(join(raiz, 'lib')), ...arquivos(join(raiz, 'app'))].map((f) => readFileSync(f, 'utf8')).join('\n');
  const usadas = new Set<string>();
  for (const m of fonte.matchAll(/juntar\('empresas', [^,()]+, '([a-z_]+)'/g)) usadas.add(m[1]);
  for (const m of fonte.matchAll(/this\.e\([a-zA-Z.]+, '([a-z_]+)'/g)) usadas.add(m[1]);
  for (const m of fonte.matchAll(/`empresas\/\$\{[^}]+\}\/([a-z_]+)/g)) usadas.add(m[1]);
  for (const m of fonte.matchAll(/collection\('([a-z_]+)'\)/g)) if (!['empresas'].includes(m[1])) usadas.add(m[1]);
  const topo = new Set<string>();
  for (const m of fonte.matchAll(/juntar\('([a-zA-Z_]+)'/g)) if (m[1] !== 'empresas') topo.add(m[1]);
  it('subcoleções de empresas/{id}', () => {
    const sem = [...usadas].filter((c) => !REGRAS_EMPRESA[c] && !SO_SERVIDOR_TOPO.includes(c) && c !== 'reunioes_storage');
    // 'estudio' e 'reunioes' também são pastas do Storage (cobertas por storage.rules)
    expect(sem.filter((c) => c !== 'estudio')).toEqual([]);
    for (const c of COLECOES) expect(REGRAS_EMPRESA[c], c).toBeDefined();
  });
  it('coleções do topo', () => {
    expect([...topo].filter((c) => c !== 'usuarios' && !SO_SERVIDOR_TOPO.includes(c))).toEqual([]);
  });
});
