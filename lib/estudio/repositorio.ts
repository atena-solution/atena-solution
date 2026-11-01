// Acesso a dados do Estúdio. TODA operação recebe a empresaId e nunca devolve
// dado de outra empresa. Implementação em memória (testes e SIMULAR=1) e em
// Firestore (repositorio-firestore.ts).
import type { Pauta } from './calendario';
import type { Criacao, KitMarca, LancamentoCredito } from './tipos';

export interface OperacaoCredito<T> {
  (estado: { saldo: number; extrato: LancamentoCredito[] }): { saldo: number; lancamento: LancamentoCredito | null; resultado: T };
}

export interface RepositorioEstudio {
  lerKit(empresaId: string): Promise<KitMarca | null>;
  salvarKit(empresaId: string, kit: KitMarca): Promise<void>;

  salvarCriacao(c: Criacao): Promise<void>;
  obterCriacao(empresaId: string, id: string): Promise<Criacao | null>;
  listarCriacoes(empresaId: string): Promise<Criacao[]>;
  apagarCriacao(empresaId: string, id: string): Promise<boolean>;

  salvarPautas(empresaId: string, pautas: Pauta[]): Promise<void>;
  listarPautas(empresaId: string, mes: string /* AAAA-MM */): Promise<Pauta[]>;
  obterPauta(empresaId: string, id: string): Promise<Pauta | null>;

  /** Lê saldo + extrato e grava o resultado de forma atômica (transação no Firestore). */
  transacaoCreditos<T>(empresaId: string, op: OperacaoCredito<T>): Promise<T>;
  extrato(empresaId: string): Promise<LancamentoCredito[]>;
  saldo(empresaId: string): Promise<number>;
}

export class ErroEmpresa extends Error {
  constructor() {
    super('Este item não pertence à sua empresa.');
  }
}

/** Garante que o objeto é da empresa pedida; senão erro (nunca vaza). */
export function exigirMesmaEmpresa<T extends { empresaId: string }>(item: T | null | undefined, empresaId: string): T | null {
  if (!item) return null;
  if (item.empresaId !== empresaId) throw new ErroEmpresa();
  return item;
}

export class RepositorioMemoria implements RepositorioEstudio {
  private kits = new Map<string, KitMarca>();
  private criacoes = new Map<string, Map<string, Criacao>>();
  private pautas = new Map<string, Map<string, Pauta>>();
  private saldos = new Map<string, number>();
  private extratos = new Map<string, LancamentoCredito[]>();
  private fila: Promise<unknown> = Promise.resolve();

  constructor(saldosIniciais: Record<string, number> = {}) {
    for (const [e, s] of Object.entries(saldosIniciais)) this.saldos.set(e, s);
  }

  private de<T>(m: Map<string, Map<string, T>>, empresaId: string) {
    exigirId(empresaId);
    let x = m.get(empresaId);
    if (!x) m.set(empresaId, (x = new Map()));
    return x;
  }

  async lerKit(empresaId: string) {
    exigirId(empresaId);
    return clonar(this.kits.get(empresaId) ?? null);
  }
  async salvarKit(empresaId: string, kit: KitMarca) {
    exigirId(empresaId);
    this.kits.set(empresaId, clonar(kit));
  }

  async salvarCriacao(c: Criacao) {
    const m = this.de(this.criacoes, c.empresaId);
    m.set(c.id, clonar(c));
  }
  async obterCriacao(empresaId: string, id: string) {
    return clonar(exigirMesmaEmpresa(this.de(this.criacoes, empresaId).get(id), empresaId));
  }
  async listarCriacoes(empresaId: string) {
    return [...this.de(this.criacoes, empresaId).values()].filter((c) => c.empresaId === empresaId).map(clonar);
  }
  async apagarCriacao(empresaId: string, id: string) {
    return this.de(this.criacoes, empresaId).delete(id);
  }

  async salvarPautas(empresaId: string, pautas: Pauta[]) {
    const m = this.de(this.pautas, empresaId);
    for (const p of pautas) {
      if (p.empresaId !== empresaId) throw new ErroEmpresa();
      m.set(p.id, clonar(p));
    }
  }
  async listarPautas(empresaId: string, mes: string) {
    return [...this.de(this.pautas, empresaId).values()].filter((p) => p.data.startsWith(mes)).sort((a, b) => a.data.localeCompare(b.data)).map(clonar);
  }
  async obterPauta(empresaId: string, id: string) {
    return clonar(exigirMesmaEmpresa(this.de(this.pautas, empresaId).get(id), empresaId));
  }

  async transacaoCreditos<T>(empresaId: string, op: OperacaoCredito<T>): Promise<T> {
    exigirId(empresaId);
    // Serializa para simular a atomicidade da transação.
    const rodar = async () => {
      const saldo = this.saldos.get(empresaId) ?? 0;
      const extrato = this.extratos.get(empresaId) ?? [];
      const r = op({ saldo, extrato: extrato.map(clonar) });
      if (r.lancamento && r.lancamento.empresaId !== empresaId) throw new ErroEmpresa();
      this.saldos.set(empresaId, r.saldo);
      if (r.lancamento) this.extratos.set(empresaId, [...extrato, r.lancamento]);
      return r.resultado;
    };
    const p = this.fila.then(rodar, rodar);
    this.fila = p.catch(() => undefined);
    return p;
  }
  async extrato(empresaId: string) {
    exigirId(empresaId);
    return (this.extratos.get(empresaId) ?? []).map(clonar);
  }
  async saldo(empresaId: string) {
    exigirId(empresaId);
    return this.saldos.get(empresaId) ?? 0;
  }
}

function exigirId(empresaId: string) {
  if (!empresaId || typeof empresaId !== 'string') throw new Error('empresaId obrigatório.');
}

function clonar<T>(x: T): T {
  return x === null || x === undefined ? x : structuredClone(x);
}
