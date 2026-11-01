import type { Banco } from './banco';
import { juntar, segmentoSeguro } from './banco';
import type { Colecao, Empresa } from '../tipos';

/**
 * Acesso preso a UMA empresa. Toda rota usa isto com o empresaId da sessão,
 * então é impossível (por construção) ler ou gravar fora de empresas/{empresaId}.
 */
export function daEmpresa(b: Banco, empresaId: string) {
  const base = juntar('empresas', segmentoSeguro(empresaId));
  const doc = (colecao: Colecao, id: string) => `${base}/${juntar(colecao, id)}`;
  return {
    empresaId,
    obterEmpresa: () => b.obter<Empresa>(base),
    mesclarEmpresa: (dados: Partial<Empresa>) => {
      // nunca deixa trocar o id da empresa
      const { id: _ignorado, ...resto } = dados;
      void _ignorado;
      return b.mesclar<Empresa>(base, resto);
    },
    listar: <T>(colecao: Colecao) => b.listar<T>(`${base}/${segmentoSeguro(colecao)}`),
    obter: <T>(colecao: Colecao, id: string) => b.obter<T>(doc(colecao, id)),
    gravar: <T extends object>(colecao: Colecao, id: string, dados: T) => b.gravar(doc(colecao, id), dados),
    mesclar: <T extends object>(colecao: Colecao, id: string, dados: Partial<T>) => b.mesclar(doc(colecao, id), dados),
    apagar: (colecao: Colecao, id: string) => b.apagar(doc(colecao, id)),
  };
}

export type AcessoEmpresa = ReturnType<typeof daEmpresa>;

/** Gera ids curtos e ordenáveis por tempo. */
export function novoId(prefixo = ''): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefixo}${t}${r}`;
}
