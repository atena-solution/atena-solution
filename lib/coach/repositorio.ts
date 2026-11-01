// Acesso a dados do Coach. Toda função recebe empresaId: não existe leitura "sem empresa".
// Implementação em memória (testes e SIMULAR=1). A do Firestore fica em repositorio-firestore.ts.
import type { ConfigCoach, Reuniao, Roteiro } from './tipos';

export interface RepositorioCoach {
  obterRoteiro(empresaId: string): Promise<Roteiro | null>;
  salvarRoteiro(empresaId: string, r: Roteiro): Promise<void>;
  obterConfig(empresaId: string): Promise<ConfigCoach | null>;
  salvarConfig(empresaId: string, c: ConfigCoach): Promise<void>;
  obterReuniao(empresaId: string, id: string): Promise<Reuniao | null>;
  salvarReuniao(r: Reuniao): Promise<void>;
  /** Lê, altera e grava de forma atômica (no Firestore: transação). Devolve a reunião gravada. */
  atualizarReuniao(empresaId: string, id: string, fn: (r: Reuniao) => Reuniao): Promise<Reuniao | null>;
  listarReunioes(empresaId: string, filtro?: { vendedorUid?: string; contatoId?: string; desdeISO?: string; limite?: number }): Promise<Reuniao[]>;
}

/** Caminhos no Firestore (contrato da Base). */
export const caminhos = {
  reunioes: (empresaId: string) => `empresas/${empresaId}/reunioes`,
  reuniao: (empresaId: string, id: string) => `empresas/${empresaId}/reunioes/${id}`,
  roteiro: (empresaId: string) => `empresas/${empresaId}/coach/roteiro`,
  config: (empresaId: string) => `empresas/${empresaId}/coach/config`,
  audio: (empresaId: string, reuniaoId: string, nome: string) => `empresas/${empresaId}/reunioes/${reuniaoId}/${nome}`,
};

const copia = <T>(x: T): T => (x === null || x === undefined ? x : structuredClone(x));

export function repositorioEmMemoria(): RepositorioCoach & { _dados: Map<string, unknown> } {
  const dados = new Map<string, unknown>();
  return {
    _dados: dados,
    async obterRoteiro(e) { return copia((dados.get(caminhos.roteiro(e)) as Roteiro) ?? null); },
    async salvarRoteiro(e, r) { dados.set(caminhos.roteiro(e), copia(r)); },
    async obterConfig(e) { return copia((dados.get(caminhos.config(e)) as ConfigCoach) ?? null); },
    async salvarConfig(e, c) { dados.set(caminhos.config(e), copia(c)); },
    async obterReuniao(e, id) {
      const r = dados.get(caminhos.reuniao(e, id)) as Reuniao | undefined;
      return r && r.empresaId === e ? copia(r) : null;
    },
    async salvarReuniao(r) { dados.set(caminhos.reuniao(r.empresaId, r.id), copia(r)); },
    async atualizarReuniao(e, id, fn) {
      const r = dados.get(caminhos.reuniao(e, id)) as Reuniao | undefined;
      if (!r || r.empresaId !== e) return null;
      const nova = fn(copia(r));
      dados.set(caminhos.reuniao(e, id), copia(nova));
      return copia(nova);
    },
    async listarReunioes(e, f = {}) {
      const pref = `${caminhos.reunioes(e)}/`;
      let lista = [...dados.entries()]
        .filter(([k]) => k.startsWith(pref))
        .map(([, v]) => v as Reuniao)
        .filter((r) => r.empresaId === e);
      if (f.vendedorUid) lista = lista.filter((r) => r.vendedorUid === f.vendedorUid);
      if (f.contatoId) lista = lista.filter((r) => r.contatoId === f.contatoId);
      if (f.desdeISO) lista = lista.filter((r) => r.criadoEm >= f.desdeISO!);
      lista.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
      return copia(lista.slice(0, f.limite ?? 500));
    },
  };
}
