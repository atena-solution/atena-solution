'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from './cx';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  children: ReactNode;
  rodape?: ReactNode;
  /** "modal" no centro; "folha" desliza da direita (no celular, de baixo). */
  tipo?: 'modal' | 'folha';
  largura?: 'p' | 'm' | 'g';
}

const larguras = { p: 'max-w-md', m: 'max-w-xl', g: 'max-w-3xl' };

export function Modal({ aberto, aoFechar, titulo, descricao, children, rodape, tipo = 'modal', largura = 'm' }: Props) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const foco = caixa.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-fechar])');
    (foco ?? caixa.current)?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      if (e.key === 'Tab' && caixa.current) {
        const itens = caixa.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (itens.length === 0) return;
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      anterior?.focus();
    };
  }, [aberto, aoFechar]);

  if (!aberto || typeof document === 'undefined') return null;

  const folha = tipo === 'folha';
  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={aoFechar} aria-hidden />
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={cx(
          'entrar relative flex max-h-full w-full flex-col border border-borda bg-superficie shadow-2xl',
          folha
            ? 'mt-auto max-h-[92dvh] rounded-t-2xl md:mt-0 md:ml-auto md:h-full md:max-h-none md:max-w-lg md:rounded-none md:rounded-l-2xl'
            : cx('m-auto max-h-[90dvh] rounded-2xl mx-4', larguras[largura]),
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-borda px-5 py-4">
          <div>
            <h2 className="text-base font-semibold tracking-tight">{titulo}</h2>
            {descricao && <p className="mt-0.5 text-[13px] text-texto-2">{descricao}</p>}
          </div>
          <button
            data-fechar
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-texto-3 hover:bg-superficie-2 hover:text-texto"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-borda px-5 py-3">{rodape}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Atalho para a variante lateral. */
export function Folha(props: Omit<Props, 'tipo'>) {
  return <Modal {...props} tipo="folha" />;
}
