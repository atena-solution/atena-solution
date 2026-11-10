import type { Banco } from '../dados/banco';
import { juntar } from '../dados/banco';
import type { Membro, Papel, Sessao } from '../tipos';
import { ErroHttp } from './erros';
import { papelPermitido } from './permissoes';

/**
 * Autenticação no servidor.
 * - Real: verifica o idToken do Firebase (Admin SDK `verifyIdToken`).
 *   Doc: https://firebase.google.com/docs/auth/admin/verify-id-tokens (consultada em 01/11/2026). // CONFIRMAR AO VIVO
 * - Simulado (SIMULAR=1): aceita "simulado:<uid>:<email>" — nunca ativo em produção.
 *
 * Empresa da sessão: header `x-empresa-id` (se o usuário estiver em mais de uma) ou `usuarios/{uid}.empresaAtual`.
 * O papel vem SEMPRE do documento empresas/{id}/membros/{uid} — nunca do cliente.
 */

export interface Identidade {
  uid: string;
  email: string;
  nome?: string;
}

export interface Usuario {
  uid: string;
  email: string;
  nome: string;
  empresaAtual?: string;
  empresas: string[];
}

export function lerBearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : null;
}

/** Interpreta o token simulado. Função pura (testada). */
export function lerTokenSimulado(token: string): Identidade | null {
  const m = /^simulado:([A-Za-z0-9_-]{1,64}):([^:\s]+@[^:\s]+)$/.exec(token);
  return m ? { uid: m[1], email: m[2].toLowerCase() } : null;
}

export async function verificarIdToken(token: string, simulado: boolean): Promise<Identidade | null> {
  if (simulado) return lerTokenSimulado(token);
  try {
    const { authAdmin } = await import('../integracoes/firebase-admin');
    const d = await authAdmin().verifyIdToken(token);
    return { uid: d.uid, email: (d.email ?? '').toLowerCase(), nome: d.name as string | undefined };
  } catch {
    return null;
  }
}

/** Decide a empresa e o papel a partir dos documentos. Função pura (testada). */
export function resolverSessao(
  id: Identidade,
  usuario: Usuario | null,
  empresaPedida: string | null,
  membro: Membro | null,
): Sessao | null {
  const empresaId = empresaPedida || usuario?.empresaAtual;
  if (!empresaId || !membro || !membro.ativo || membro.uid !== id.uid) return null;
  if (empresaPedida && usuario && !usuario.empresas.includes(empresaPedida)) return null;
  return { uid: id.uid, email: id.email, empresaId, papel: membro.papel };
}

export interface ContextoAuth {
  banco: Banco;
  simulado: boolean;
}

async function contextoPadrao(): Promise<ContextoAuth> {
  const { banco, simulando } = await import('../dados');
  return { banco: await banco(), simulado: simulando() };
}

export async function identificar(req: Request, ctx?: ContextoAuth): Promise<Identidade> {
  ctx ??= await contextoPadrao();
  const token = lerBearer(req);
  if (!token) throw new ErroHttp(401, 'Faça login para continuar.');
  const id = await verificarIdToken(token, ctx.simulado);
  if (!id) throw new ErroHttp(401, 'Sessão expirada. Entre de novo.');
  return id;
}

/** Sessão completa ou null quando o usuário ainda não tem empresa (vai pro onboarding). */
export async function obterSessao(
  req: Request,
  ctx?: ContextoAuth,
): Promise<{ id: Identidade; sessao: Sessao | null; usuario: Usuario | null }> {
  ctx ??= await contextoPadrao();
  const id = await identificar(req, ctx);
  const usuario = await ctx.banco.obter<Usuario>(juntar('usuarios', id.uid));
  const pedida = req.headers.get('x-empresa-id');
  const empresaId = pedida || usuario?.empresaAtual;
  const membro = empresaId ? await ctx.banco.obter<Membro>(juntar('empresas', empresaId, 'membros', id.uid)) : null;
  return { id, usuario, sessao: resolverSessao(id, usuario, pedida, membro) };
}

/** Exige login + empresa + (opcional) um dos papéis. Lança ErroHttp 401/403. */
export async function exigirEmpresa(req: Request, papeisPermitidos?: Papel[], ctx?: ContextoAuth): Promise<Sessao> {
  const { sessao } = await obterSessao(req, ctx);
  if (!sessao) throw new ErroHttp(403, 'Você não faz parte desta empresa.');
  if (!papelPermitido(sessao.papel, papeisPermitidos)) throw new ErroHttp(403, 'Seu papel não permite esta ação.');
  return sessao;
}
