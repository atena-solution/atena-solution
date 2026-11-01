import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo';
type Tamanho = 'p' | 'm' | 'g';

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  icone?: ReactNode;
  larguraTotal?: boolean;
}

const variantes: Record<Variante, string> = {
  primario: 'gradiente-atena text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset] hover:brightness-110',
  secundario: 'bg-superficie text-texto border border-borda hover:border-borda-forte hover:bg-superficie-2',
  fantasma: 'text-texto-2 hover:text-texto hover:bg-superficie-2',
  perigo: 'bg-erro text-white hover:brightness-110',
};

const tamanhos: Record<Tamanho, string> = {
  p: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  m: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  g: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
};

export const Botao = forwardRef<HTMLButtonElement, BotaoProps>(function Botao(
  { variante = 'primario', tamanho = 'm', carregando, icone, larguraTotal, className, children, disabled, type, ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cx(
        'inline-flex items-center justify-center font-medium whitespace-nowrap select-none transition-all duration-150',
        'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
        variantes[variante],
        tamanhos[tamanho],
        larguraTotal && 'w-full',
        className,
      )}
      {...resto}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
});
