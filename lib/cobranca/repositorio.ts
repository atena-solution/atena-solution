// Onde a cobrança guarda as coisas. Interface + versão em memória (SIMULAR=1 e testes).
// A versão Firestore fica em `repositorio-firestore.ts`.
//
// Firestore:
//   empresas/{empresaId}                         → campo `plano: { abas, creditos }` (contrato da Base)
//   empresas/{empresaId}/cobranca/assinatura     → Assinatura
//   empresas/{empresaId}/pagamentos/{pagId}      → RegistroPagamento
//   empresas/{empresaId}/creditos/{movId}        → MovimentoCredito (extrato)
//   atena_alertas/{id}                           → alertas para o painel /admin (fora de qualquer empresa)

import type { Assinatura } from '../planos/acesso';
import type { Aba } from '../planos/config';
import type { MovimentoCredito } from '../planos/creditos';
import type { EstadoCobranca, Mudancas, RegistroPagamento } from './liberacao';

export interface AlertaCobranca {
  empresaId: string | null;
  pagamentoId?: string;
  motivo: string;
  quando: string;
}

export interface RepositorioCobranca {
  obterAssinatura(empresaId: string): Promise<Assinatura | null>;
  salvarAssinatura(a: Assinatura): Promise<void>;
  obterSaldo(empresaId: string): Promise<number>;
  extrato(empresaId: string, limite?: number): Promise<MovimentoCredito[]>;
  pagamentos(empresaId: string, limite?: number): Promise<RegistroPagamento[]>;
  /** Lê o estado, decide e grava tudo junto (transação). */
  transacao(
    empresaId: string,
    pagamentoId: string,
    decidir: (estado: EstadoCobranca) => Mudancas | null,
  ): Promise<Mudancas | null>;
  /** Acha a empresa pelo cliente do Asaas (usado só para conferência e alertas). */
  empresaDoClienteAsaas(clienteId: string): Promise<string | null>;
  alertar(a: AlertaCobranca): Promise<void>;
  alertas(limite?: number): Promise<AlertaCobranca[]>;
  listarAssinaturas(): Promise<Assinatura[]>;
  /** Atualiza `empresas/{id}.plano.abas` (contrato da Base). O saldo (`plano.creditos`) só muda em `transacao`. */
  gravarAbasDaEmpresa(empresaId: string, abas: Aba[]): Promise<void>;
  abasDaEmpresa(empresaId: string): Promise<Aba[]>;
}

export function criarRepositorioMemoria(): RepositorioCobranca & { _dados: unknown } {
  const assinaturas = new Map<string, Assinatura>();
  const saldos = new Map<string, number>();
  const registros = new Map<string, Map<string, RegistroPagamento>>();
  const movimentos = new Map<string, MovimentoCredito[]>();
  const abasEmpresa = new Map<string, Aba[]>();
  const alertas: AlertaCobranca[] = [];
  const filas = new Map<string, Promise<unknown>>();

  const regs = (e: string) => {
    if (!registros.has(e)) registros.set(e, new Map());
    return registros.get(e)!;
  };

  return {
    _dados: { assinaturas, saldos, registros, movimentos, abasEmpresa, alertas },
    async obterAssinatura(e) { const a = assinaturas.get(e); return a ? { ...a } : null; },
    async salvarAssinatura(a) { assinaturas.set(a.empresaId, { ...a }); },
    async obterSaldo(e) { return saldos.get(e) ?? 0; },
    async extrato(e, limite = 50) { return [...(movimentos.get(e) ?? [])].reverse().slice(0, limite); },
    async pagamentos(e, limite = 50) { return [...regs(e).values()].reverse().slice(0, limite); },
    async transacao(empresaId, pagamentoId, decidir) {
      // Serializa por empresa, como uma transação faria.
      const anterior = filas.get(empresaId) ?? Promise.resolve();
      const atual = anterior.then(async () => {
        const estado: EstadoCobranca = {
          empresaId,
          assinatura: assinaturas.has(empresaId) ? { ...assinaturas.get(empresaId)! } : null,
          saldoCreditos: saldos.get(empresaId) ?? 0,
          registro: regs(empresaId).get(pagamentoId) ?? null,
        };
        const m = decidir(estado);
        if (!m) return null;
        if (m.assinatura) assinaturas.set(empresaId, { ...m.assinatura });
        if (m.saldoCreditos !== undefined) saldos.set(empresaId, m.saldoCreditos);
        if (m.movimento) movimentos.set(empresaId, [...(movimentos.get(empresaId) ?? []), m.movimento]);
        if (m.registro) regs(empresaId).set(pagamentoId, m.registro);
        return m;
      });
      filas.set(empresaId, atual.catch(() => undefined));
      return atual;
    },
    async empresaDoClienteAsaas(c) {
      for (const a of assinaturas.values()) if (a.asaasClienteId === c) return a.empresaId;
      return null;
    },
    async alertar(a) { alertas.push(a); },
    async alertas(limite = 50) { return [...alertas].reverse().slice(0, limite); },
    async listarAssinaturas() { return [...assinaturas.values()].map((a) => ({ ...a })); },
    async gravarAbasDaEmpresa(e, abas) { abasEmpresa.set(e, [...abas]); },
    async abasDaEmpresa(e) { return abasEmpresa.get(e) ?? []; },
  };
}
