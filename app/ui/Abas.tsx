'use client';

import { useId, useRef, type ReactNode } from 'react';
import { cx } from './cx';

export interface Aba {
  id: string;
  rotulo: string;
  contagem?: number;
  icone?: ReactNode;
}

/** Abas acessíveis (setas do teclado mudam de aba). Controladas por `ativa`. */
export function Abas({
  abas,
  ativa,
  aoMudar,
  className,
}: {
  abas: Aba[];
  ativa: string;
  aoMudar: (id: string) => void;
  className?: string;
}) {
  const base = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function teclado(e: React.KeyboardEvent, i: number) {
    let prox = -1;
    if (e.key === 'ArrowRight') prox = (i + 1) % abas.length;
    if (e.key === 'ArrowLeft') prox = (i - 1 + abas.length) % abas.length;
    if (e.key === 'Home') prox = 0;
    if (e.key === 'End') prox = abas.length - 1;
    if (prox >= 0) {
      e.preventDefault();
      aoMudar(abas[prox].id);
      refs.current[prox]?.focus();
    }
  }

  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto border-b border-borda', className)}>
      {abas.map((a, i) => {
        const sel = a.id === ativa;
        return (
          <button
            key={a.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${base}-${a.id}`}
            aria-selected={sel}
            tabIndex={sel ? 0 : -1}
            onClick={() => aoMudar(a.id)}
            onKeyDown={(e) => teclado(e, i)}
            className={cx(
              'relative -mb-px inline-flex h-10 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
              sel ? 'text-texto' : 'text-texto-3 hover:text-texto-2',
            )}
          >
            {a.icone && <span className="[&>svg]:size-4">{a.icone}</span>}
            {a.rotulo}
            {a.contagem !== undefined && (
              <span className="numero rounded-full bg-superficie-2 px-1.5 text-[11px] text-texto-2">{a.contagem}</span>
            )}
            <span
              aria-hidden
              className={cx(
                'gradiente-atena absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity duration-200',
                sel ? 'opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
