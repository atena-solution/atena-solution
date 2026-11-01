import type { Banco } from './banco';
import { BancoMemoria } from './banco';
import { semearDemo } from './demo';

/** true quando as integrações externas devem ser simuladas (sessões na nuvem, testes). */
export function simulando(): boolean {
  return process.env.SIMULAR === '1' || !process.env.FIREBASE_SERVICE_ACCOUNT;
}

const g = globalThis as unknown as { __atenaBanco?: Banco; __atenaBancoPronto?: Promise<void> };

/** Banco do processo. Em modo simulado, memória com dados de demonstração (sobrevive ao recarregar do dev). */
export async function banco(): Promise<Banco> {
  if (!g.__atenaBanco) {
    if (simulando()) {
      const m = new BancoMemoria();
      g.__atenaBanco = m;
      g.__atenaBancoPronto = semearDemo(m);
    } else {
      const { BancoFirestore } = await import('./firestore');
      g.__atenaBanco = new BancoFirestore();
    }
  }
  await g.__atenaBancoPronto;
  return g.__atenaBanco;
}

/** Só para testes: troca o banco do processo. */
export function definirBanco(b: Banco) {
  g.__atenaBanco = b;
  g.__atenaBancoPronto = undefined;
}

export { daEmpresa } from './empresa';
export type { Banco } from './banco';
