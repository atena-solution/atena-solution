/**
 * Acesso a dados por caminho de documento (estilo Firestore).
 * Dois motores: memória (SIMULAR=1 / testes) e Firestore (Admin SDK, no servidor).
 * Ninguém usa isto direto nas rotas: use `daEmpresa(empresaId)` (lib/dados/empresa.ts),
 * que prende tudo dentro de empresas/{empresaId}.
 */

export interface Banco {
  obter<T>(caminho: string): Promise<T | null>;
  listar<T>(colecao: string): Promise<T[]>;
  /** Grava o documento inteiro (substitui). */
  gravar<T extends object>(caminho: string, dados: T): Promise<void>;
  /** Mescla campos no documento existente (cria se não existir). */
  mesclar<T extends object>(caminho: string, dados: Partial<T>): Promise<void>;
  apagar(caminho: string): Promise<void>;
}

/** Segmentos de caminho seguros: impede "../", "/" e vazios vindos do usuário. */
export function segmentoSeguro(s: string): string {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_.@+-]{1,200}$/.test(s) || s === '.' || s === '..') {
    throw new Error(`Identificador inválido: ${JSON.stringify(s)}`);
  }
  return s;
}

export function juntar(...segmentos: string[]): string {
  return segmentos.map(segmentoSeguro).join('/');
}

function contar(caminho: string): number {
  return caminho.split('/').length;
}

export class BancoMemoria implements Banco {
  docs = new Map<string, unknown>();

  async obter<T>(caminho: string): Promise<T | null> {
    const v = this.docs.get(caminho);
    return v === undefined ? null : (structuredClone(v) as T);
  }

  async listar<T>(colecao: string): Promise<T[]> {
    const prefixo = colecao + '/';
    const n = contar(colecao) + 1;
    const r: T[] = [];
    for (const [k, v] of this.docs) {
      if (k.startsWith(prefixo) && contar(k) === n) r.push(structuredClone(v) as T);
    }
    return r;
  }

  async gravar<T extends object>(caminho: string, dados: T): Promise<void> {
    this.docs.set(caminho, structuredClone(dados));
  }

  async mesclar<T extends object>(caminho: string, dados: Partial<T>): Promise<void> {
    const atual = (this.docs.get(caminho) as object | undefined) ?? {};
    this.docs.set(caminho, structuredClone({ ...atual, ...dados }));
  }

  async apagar(caminho: string): Promise<void> {
    this.docs.delete(caminho);
  }
}
