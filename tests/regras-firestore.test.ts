import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESCRITA_POR_COLECAO } from '@/lib/auth/permissoes';
import { COLECOES } from '@/lib/tipos';

/**
 * Sem emulador na nuvem: conferimos que firestore.rules e lib/auth/permissoes.ts dizem a MESMA coisa.
 * (Teste das regras no emulador: `firebase emulators:exec` — fazer no Mac.)
 */
const regras = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

function papeisDaEscrita(colecao: string): string[] | null {
  const bloco = new RegExp(`match /${colecao}/\\{id(=\\*\\*)?\\}[^}]*?allow write: if papelEm\\(empresaId, \\[([^\\]]+)\\]\\)`, 's').exec(regras);
  if (!bloco) {
    const membrosOuConvites = new RegExp(`match /${colecao}/\\{(uid|email)\\}[^}]*?allow (read, )?write: if papelEm\\(empresaId, \\[([^\\]]+)\\]\\)`, 's').exec(regras);
    if (!membrosOuConvites) return null;
    return membrosOuConvites[3].split(',').map((s) => s.trim().replace(/'/g, ''));
  }
  return bloco[2].split(',').map((s) => s.trim().replace(/'/g, ''));
}

describe('firestore.rules', () => {
  for (const c of COLECOES) {
    it(`escrita em ${c} igual a permissoes.ts`, () => {
      expect(papeisDaEscrita(c)?.sort()).toEqual([...ESCRITA_POR_COLECAO[c]].sort());
    });
  }
  it('empresa: update só dono/gestor e sem mexer no plano', () => {
    expect(regras).toMatch(/allow update: if papelEm\(empresaId, \['dono', 'gestor'\]\)/);
    expect(regras).toMatch(/request\.resource\.data\.plano == resource\.data\.plano/);
  });
  it('nada aberto para quem não está logado', () => {
    expect(regras).not.toMatch(/allow (read|write)[^;]*: if true/);
  });
});
