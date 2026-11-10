'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType, ReactNode } from 'react';
import { cx } from './cx';

export interface ItemSubNav {
  href: string;
  rotulo: string;
  icone?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** Só ativo no caminho exato (ex.: a página inicial da aba). */
  exato?: boolean;
}

/** Navegação interna de uma aba (Coach, Estúdio…): mesmo visual das Abas, com links. */
export function SubNav({ rotulo, itens, extra, className }: { rotulo: string; itens: ItemSubNav[]; extra?: ReactNode; className?: string }) {
  const caminho = usePathname() ?? '';
  return (
    <div className={cx('mb-6 flex items-center gap-3 border-b border-borda', className)}>
      <nav aria-label={rotulo} className="-mb-px min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
        <ul className="flex w-max gap-1">
          {itens.map(({ href, rotulo: r, icone: Icone, exato }) => {
            const ativo = exato ? caminho === href : caminho === href || caminho.startsWith(href + '/');
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={ativo ? 'page' : undefined}
                  className={cx(
                    'relative inline-flex h-10 items-center gap-1.5 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                    ativo ? 'text-texto' : 'text-texto-3 hover:text-texto-2',
                  )}
                >
                  {Icone && <Icone className="size-4" aria-hidden />}
                  {r}
                  <span aria-hidden className={cx('gradiente-atena absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity duration-200', ativo ? 'opacity-100' : 'opacity-0')} />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {extra && <div className="shrink-0 pb-1.5">{extra}</div>}
    </div>
  );
}
