import type { ReactNode } from 'react';
import { cx } from './cx';

export type TomSelo = 'neutro' | 'acento' | 'sucesso' | 'atencao' | 'erro' | 'atendimento' | 'coach' | 'estudio';

const tons: Record<TomSelo, string> = {
  neutro: 'bg-superficie-2 text-texto-2 border-borda',
  acento: 'bg-acento-1/10 text-acento border-acento-1/20',
  sucesso: 'bg-sucesso/10 text-sucesso border-sucesso/25',
  atencao: 'bg-atencao/10 text-atencao border-atencao/25',
  erro: 'bg-erro/10 text-erro border-erro/25',
  atendimento: 'bg-atendimento/10 text-atendimento border-atendimento/25',
  coach: 'bg-coach/10 text-coach border-coach/25',
  estudio: 'bg-estudio/10 text-estudio border-estudio/25',
};

export function Selo({
  tom = 'neutro',
  ponto,
  aoVivo,
  children,
  className,
}: {
  tom?: TomSelo;
  ponto?: boolean;
  aoVivo?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap',
        tons[tom],
        className,
      )}
    >
      {(ponto || aoVivo) && <span className={cx('size-1.5 rounded-full bg-current', aoVivo && 'ao-vivo')} aria-hidden />}
      {children}
    </span>
  );
}
