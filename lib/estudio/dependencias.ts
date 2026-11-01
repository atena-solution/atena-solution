// Monta as dependências reais ou simuladas do Estúdio (só no servidor).
import { randomUUID } from 'node:crypto';
import * as imagem from '../integracoes/imagem';
import { RepositorioMemoria, type OperacaoCredito, type RepositorioEstudio } from './repositorio';
import type { Dependencias } from './servico';
import { gerarTextoPost } from './texto-ia';

/** Saldo inicial de demonstração no modo simulado. */
export const SALDO_DEMO = 120;

const g = globalThis as unknown as { __estudioRepoSimulado?: RepositorioMemoria };

class RepositorioDemo extends RepositorioMemoria {
  private iniciadas = new Set<string>();
  private async garantir(empresaId: string) {
    if (this.iniciadas.has(empresaId)) return;
    this.iniciadas.add(empresaId);
    await super.transacaoCreditos(empresaId, ({ saldo }) => ({
      saldo: saldo + SALDO_DEMO,
      lancamento: { id: `demo-${empresaId}`, empresaId, tipo: 'recarga', valor: SALDO_DEMO, saldoDepois: saldo + SALDO_DEMO, motivo: 'Créditos de demonstração', quando: new Date().toISOString() },
      resultado: null,
    }));
  }
  override async saldo(empresaId: string) { await this.garantir(empresaId); return super.saldo(empresaId); }
  override async extrato(empresaId: string) { await this.garantir(empresaId); return super.extrato(empresaId); }
  override async transacaoCreditos<T>(empresaId: string, op: OperacaoCredito<T>): Promise<T> {
    await this.garantir(empresaId);
    return super.transacaoCreditos(empresaId, op);
  }
}

/** Fornecedor do repositório real: a Base registra aqui o Firestore (ver app/api/estudio/_contexto.ts). */
let fabricaReal: (() => RepositorioEstudio) | null = null;
export function registrarRepositorio(f: () => RepositorioEstudio) {
  fabricaReal = f;
}

export function repositorio(): RepositorioEstudio {
  if (process.env.SIMULAR === '1' || !fabricaReal) {
    if (process.env.SIMULAR !== '1') throw new Error('Repositório do Estúdio não configurado (ou use SIMULAR=1).');
    return (g.__estudioRepoSimulado ??= new RepositorioDemo());
  }
  return fabricaReal();
}

export function dependencias(): Dependencias {
  return {
    repo: repositorio(),
    gerarImagens: imagem.gerarImagens,
    iniciarVideo: imagem.iniciarVideo,
    consultarVideo: imagem.consultarVideo,
    gerarTextoPost,
    agora: () => new Date().toISOString(),
    novoId: () => randomUUID(),
  };
}
