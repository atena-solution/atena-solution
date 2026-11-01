import type { ReactNode } from 'react';
import { cx } from './cx';

/** Estado vazio que ensina o próximo passo. */
export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: ReactNode;
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {icone && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border border-borda bg-superficie-2 text-texto-2 [&>svg]:size-5">
          {icone}
        </div>
      )}
      <h3 className="text-[15px] font-semibold text-texto">{titulo}</h3>
      {descricao && <p className="mt-1 max-w-sm text-sm text-texto-2">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}
