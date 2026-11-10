'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Empresa, Membro, Sessao } from './tipos';
import { observarUsuario, tokenAtual, type UsuarioCliente } from './auth/cliente';

/**
 * Sessão no navegador: usuário, empresa atual, papel e um `api()` que já manda o token e a empresa.
 * Use em qualquer tela logada:  const { empresa, sessao, api } = useSessao();
 */

export interface EstadoSessao {
  carregando: boolean;
  usuario: UsuarioCliente | null;
  sessao: Sessao | null;
  empresa: Empresa | null;
  membro: Membro | null;
  empresas: { id: string; nome: string }[];
  /** Chama uma rota /api/* com o login. Lança Error(mensagem) se der erro. */
  api: <T = unknown>(caminho: string, opcoes?: { metodo?: string; corpo?: unknown; formulario?: FormData }) => Promise<T>;
  recarregar: () => Promise<void>;
  trocarEmpresa: (empresaId: string) => Promise<void>;
}

const Contexto = createContext<EstadoSessao | null>(null);
const CHAVE_EMPRESA = 'atena:empresa';

function empresaEscolhida(): string | null {
  try {
    return localStorage.getItem(CHAVE_EMPRESA);
  } catch {
    return null;
  }
}

export async function chamarApi<T>(
  caminho: string,
  opcoes: { metodo?: string; corpo?: unknown; formulario?: FormData } = {},
): Promise<T> {
  const token = await tokenAtual();
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const emp = empresaEscolhida();
  if (emp) headers['x-empresa-id'] = emp;
  let body: BodyInit | undefined;
  if (opcoes.formulario) body = opcoes.formulario;
  else if (opcoes.corpo !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opcoes.corpo);
  }
  const r = await fetch(caminho, { method: opcoes.metodo ?? (body ? 'POST' : 'GET'), headers, body });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    const erro = new Error((dados as { erro?: string }).erro ?? 'Algo deu errado. Tente de novo.') as Error & {
      status?: number;
      erros?: Record<string, string>;
    };
    erro.status = r.status;
    erro.erros = (dados as { erros?: Record<string, string> }).erros;
    throw erro;
  }
  return dados as T;
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<UsuarioCliente | null | undefined>(undefined);
  const [dados, setDados] = useState<Pick<EstadoSessao, 'sessao' | 'empresa' | 'membro' | 'empresas'> | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(false);

  useEffect(() => observarUsuario(setUsuario), []);

  const recarregar = useCallback(async () => {
    setCarregandoSessao(true);
    try {
      const r = await chamarApi<{
        sessao: Sessao | null;
        empresa?: Empresa;
        membro?: Membro;
        empresas?: { id: string; nome: string }[];
      }>('/api/sessao');
      if (!r.sessao) {
        try {
          localStorage.removeItem(CHAVE_EMPRESA);
        } catch {}
      }
      setDados({ sessao: r.sessao, empresa: r.empresa ?? null, membro: r.membro ?? null, empresas: r.empresas ?? [] });
    } catch {
      setDados({ sessao: null, empresa: null, membro: null, empresas: [] });
    } finally {
      setCarregandoSessao(false);
    }
  }, []);

  useEffect(() => {
    if (usuario) recarregar();
    else if (usuario === null) setDados(null);
  }, [usuario, recarregar]);

  const trocarEmpresa = useCallback(
    async (empresaId: string) => {
      try {
        localStorage.setItem(CHAVE_EMPRESA, empresaId);
      } catch {}
      await recarregar();
    },
    [recarregar],
  );

  const valor = useMemo<EstadoSessao>(
    () => ({
      carregando: usuario === undefined || (!!usuario && (dados === null || carregandoSessao && !dados.sessao)),
      usuario: usuario ?? null,
      sessao: dados?.sessao ?? null,
      empresa: dados?.empresa ?? null,
      membro: dados?.membro ?? null,
      empresas: dados?.empresas ?? [],
      api: chamarApi,
      recarregar,
      trocarEmpresa,
    }),
    [usuario, dados, carregandoSessao, recarregar, trocarEmpresa],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): EstadoSessao {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>');
  return ctx;
}

/** Hook simples para carregar dados de uma rota GET. */
export function useDados<T>(caminho: string | null) {
  const { api, sessao } = useSessao();
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    if (!caminho || !sessao) return;
    let vivo = true;
    api<T>(caminho)
      .then((d) => vivo && (setDados(d), setErro(null)))
      .catch((e: Error) => vivo && setErro(e.message));
    return () => {
      vivo = false;
    };
  }, [caminho, sessao, api, versao]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  return { dados, erro, carregando: dados === null && !erro, recarregar, setDados };
}
