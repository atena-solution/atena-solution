import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export function Cartao({ className, ...resto }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('min-w-0 rounded-cartao border border-borda bg-superficie shadow-[var(--sombra)]', className)}
      {...resto}
    />
  );
}

export function CabecalhoCartao({
  titulo,
  descricao,
  acao,
  icone,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acao?: ReactNode;
  icone?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icone && <div className="mt-0.5 text-texto-3 [&>svg]:size-[18px]">{icone}</div>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-texto">{titulo}</h3>
          {descricao && <p className="mt-0.5 text-[13px] text-texto-2">{descricao}</p>}
        </div>
      </div>
      {acao}
    </div>
  );
}

export function CorpoCartao({ className, ...resto }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('p-5', className)} {...resto} />;
}
