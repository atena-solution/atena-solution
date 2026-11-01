import { banco } from '../dados';
import { daEmpresa, type AcessoEmpresa } from '../dados/empresa';
import { exigirEmpresa } from '../auth/servidor';
import { respostaDeErro } from '../auth/erros';
import type { Papel, Sessao } from '../tipos';

export interface ContextoRota<P> {
  sessao: Sessao;
  /** Dados presos à empresa da sessão. */
  dados: AcessoEmpresa;
  params: P;
}

/**
 * Embrulha um handler de rota: exige login + empresa (+ papéis), entrega `dados` já presos
 * à empresa da sessão e transforma erros em JSON. Use em todas as rotas logadas.
 *
 *   export const GET = rota(['dono','gestor'], async (req, { dados }) => Response.json(await dados.listar('servicos')));
 */
export function rota<P = Record<string, string>>(
  papeis: Papel[] | undefined,
  handler: (req: Request, ctx: ContextoRota<P>) => Promise<Response>,
) {
  return async (req: Request, extra?: { params?: Promise<P> }) => {
    try {
      const sessao = await exigirEmpresa(req, papeis);
      const dados = daEmpresa(await banco(), sessao.empresaId);
      const params = ((await extra?.params) ?? {}) as P;
      return await handler(req, { sessao, dados, params });
    } catch (e) {
      return respostaDeErro(e);
    }
  };
}

/** Lê o corpo JSON ou lança 400. */
export async function corpo<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    const { ErroHttp } = await import('../auth/erros');
    throw new ErroHttp(400, 'Corpo da requisição inválido.');
  }
}
