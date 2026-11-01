// Monta as dependências da cobrança para as rotas (servidor).
// SIMULAR=1 (ou sem chaves): Asaas simulado + banco da Base em memória.
// Produção: Asaas real (ASAAS_API_KEY) + Firestore com transação.

import { asaas } from './asaas';
import type { Deps } from './servico';
import type { RepositorioCobranca } from './repositorio';

const g = globalThis as unknown as { __atenaRepoCobranca?: RepositorioCobranca; __atenaRepoCobrancaBanco?: unknown };

export async function depsCobranca(): Promise<Deps> {
  const { banco, simulando } = await import('../dados');
  const b = simulando() ? await banco() : null;
  if (!g.__atenaRepoCobranca || (b && g.__atenaRepoCobrancaBanco !== b)) {
    if (b) {
      const { RepositorioCobrancaBanco } = await import('./repositorio-banco');
      g.__atenaRepoCobranca = new RepositorioCobrancaBanco(b);
      g.__atenaRepoCobrancaBanco = b;
    } else {
      const { firestoreAdmin } = await import('../integracoes/firebase-admin');
      const { RepositorioCobrancaFirestore } = await import('./repositorio-firestore');
      g.__atenaRepoCobranca = new RepositorioCobrancaFirestore(firestoreAdmin() as never);
    }
  }
  return { repo: g.__atenaRepoCobranca, asaas: asaas() };
}
