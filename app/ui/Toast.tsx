'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cx } from './cx';

type TomToast = 'sucesso' | 'erro' | 'atencao' | 'info';
interface ItemToast {
  id: number;
  tom: TomToast;
  texto: string;
}

const Contexto = createContext<{ avisar: (texto: string, tom?: TomToast) => void } | null>(null);

const icones = {
  sucesso: <CheckCircle2 className="size-4 text-sucesso" />,
  erro: <XCircle className="size-4 text-erro" />,
  atencao: <AlertTriangle className="size-4 text-atencao" />,
  info: <Info className="size-4 text-acento" />,
};

export function ProvedorToast({ children }: { children: ReactNode }) {
  const [itens, setItens] = useState<ItemToast[]>([]);

  const remover = useCallback((id: number) => setItens((l) => l.filter((i) => i.id !== id)), []);
  const avisar = useCallback(
    (texto: string, tom: TomToast = 'sucesso') => {
      const id = Date.now() + Math.random();
      setItens((l) => [...l.slice(-3), { id, tom, texto }]);
      setTimeout(() => remover(id), 4000);
    },
    [remover],
  );

  return (
    <Contexto.Provider value={{ avisar }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {itens.map((i) => (
          <div
            key={i.id}
            role="status"
            className={cx(
              'entrar pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-sm shadow-lg',
            )}
          >
            {icones[i.tom]}
            <span className="flex-1">{i.texto}</span>
            <button onClick={() => remover(i.id)} aria-label="Fechar aviso" className="text-texto-3 hover:text-texto">
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ProvedorToast>');
  return ctx;
}
