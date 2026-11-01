// Chamadas às rotas do Coach a partir do navegador.
// JUNÇÃO: `cabecalhosAuth` passa a mandar o idToken do Firebase (ou o que a Base definir).
export async function cabecalhosAuth(): Promise<Record<string, string>> {
  const w = globalThis as { atenaIdToken?: () => Promise<string | null> };
  const t = w.atenaIdToken ? await w.atenaIdToken() : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

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
