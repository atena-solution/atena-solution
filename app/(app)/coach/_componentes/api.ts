// Chamadas às rotas do Coach a partir do navegador — com o mesmo login da Base.
import { cabecalhosLogin } from '@/lib/sessao';

export const cabecalhosAuth = cabecalhosLogin;

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const json = init.body && !(init.body instanceof FormData) && typeof init.body === 'string';
  const r = await fetch(url, {
    ...init,
    headers: { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(await cabecalhosAuth()), ...(init.headers ?? {}) },
  });
  const dados = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
  return dados;
}
