'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, User } from 'lucide-react';
import { createPortal } from 'react-dom';
import { navegacaoDoPlano } from '@/lib/navegacao';
import { normalizarBusca, formatarTelefone } from '@/lib/ui/formato';
import { useSessao } from '@/lib/sessao';
import { ICONES_NAV, cx } from '@/app/ui';
import type { Contato } from '@/lib/tipos';

interface Resultado {
  id: string;
  titulo: string;
  sub?: string;
  href: string;
  tipo: 'pagina' | 'contato' | 'acao';
}

const ACOES: Resultado[] = [
  { id: 'a-contato', titulo: 'Novo contato', href: '/contatos?novo=1', tipo: 'acao' },
  { id: 'a-agenda', titulo: 'Marcar horário', href: '/agenda?novo=1', tipo: 'acao' },
  { id: 'a-equipe', titulo: 'Convidar pessoa da equipe', href: '/configuracoes?aba=equipe', tipo: 'acao' },
  { id: 'a-servicos', titulo: 'Serviços e preços', href: '/configuracoes?aba=servicos', tipo: 'acao' },
];

/** Busca global (Ctrl+K): páginas, ações e contatos. */
export function BuscaGlobal({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const router = useRouter();
  const { api, empresa } = useSessao();
  const [termo, setTermo] = useState('');
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [sel, setSel] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!aberta) return;
    setTermo('');
    setSel(0);
    setTimeout(() => campo.current?.focus(), 10);
  }, [aberta]);

  useEffect(() => {
    if (!aberta || termo.trim().length < 2) {
      setContatos([]);
      return;
    }
    const t = setTimeout(() => {
      api<{ contatos: Contato[] }>(`/api/contatos?busca=${encodeURIComponent(termo)}&limite=6`)
        .then((r) => setContatos(r.contatos))
        .catch(() => setContatos([]));
    }, 180);
    return () => clearTimeout(t);
  }, [termo, aberta, api]);

  const resultados = useMemo<Resultado[]>(() => {
    const n = normalizarBusca(termo);
    const paginas: Resultado[] = navegacaoDoPlano(empresa?.plano.abas ?? []).map((i) => ({
      id: i.id,
      titulo: i.rotulo,
      href: i.href,
      tipo: 'pagina' as const,
    }));
    const fixos = [...paginas, ...ACOES].filter((r) => !n || normalizarBusca(r.titulo).includes(n));
    const cts: Resultado[] = contatos.map((c) => ({
      id: c.id,
      titulo: c.nome,
      sub: formatarTelefone(c.telefone),
      href: `/contatos/${c.id}`,
      tipo: 'contato',
    }));
    return [...cts, ...fixos];
  }, [termo, contatos, empresa]);

  useEffect(() => setSel(0), [termo]);

  if (!aberta || typeof document === 'undefined') return null;

  function ir(r: Resultado) {
    aoFechar();
    router.push(r.href);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={aoFechar} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca"
        className="entrar relative w-full max-w-xl overflow-hidden rounded-2xl border border-borda bg-superficie shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === 'Escape') aoFechar();
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, resultados.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          }
          if (e.key === 'Enter' && resultados[sel]) ir(resultados[sel]);
        }}
      >
        <div className="flex items-center gap-3 border-b border-borda px-4">
          <Search className="size-4 text-texto-3" aria-hidden />
          <input
            ref={campo}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar contato, página ou ação…"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="busca-resultados"
            aria-activedescendant={resultados[sel] ? `busca-${resultados[sel].id}` : undefined}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-texto-3"
          />
          <kbd className="numero rounded border border-borda px-1.5 text-[11px] text-texto-3">Esc</kbd>
        </div>
        <ul id="busca-resultados" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {resultados.length === 0 && <li className="px-3 py-6 text-center text-sm text-texto-3">Nada encontrado.</li>}
          {resultados.map((r, i) => {
            const Icone = r.tipo === 'pagina' ? ICONES_NAV[r.id as keyof typeof ICONES_NAV] : r.tipo === 'contato' ? User : CornerDownLeft;
            return (
              <li
                key={r.tipo + r.id}
                id={`busca-${r.id}`}
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setSel(i)}
                onClick={() => ir(r)}
                className={cx('flex h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm', i === sel && 'bg-superficie-2')}
              >
                {Icone && <Icone className="size-4 text-texto-3" aria-hidden />}
                <span className="flex-1 truncate">{r.titulo}</span>
                {r.sub && <span className="numero text-xs text-texto-3">{r.sub}</span>}
                <span className="text-[11px] text-texto-3">{r.tipo === 'contato' ? 'Contato' : r.tipo === 'acao' ? 'Ação' : 'Página'}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
