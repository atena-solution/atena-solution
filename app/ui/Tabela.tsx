import type { ReactNode } from 'react';
import { cx } from './cx';

export interface Coluna<T> {
  chave: string;
  titulo: string;
  render: (linha: T) => ReactNode;
  className?: string;
  /** Esconde no celular. */
  ocultarCelular?: boolean;
}

export function Tabela<T>({
  colunas,
  linhas,
  chaveLinha,
  aoClicar,
  vazio,
}: {
  colunas: Coluna<T>[];
  linhas: T[];
  chaveLinha: (l: T) => string;
  aoClicar?: (l: T) => void;
  vazio?: ReactNode;
}) {
  if (linhas.length === 0 && vazio) return <>{vazio}</>;
  return (
    <div className="overflow-hidden rounded-cartao border border-borda bg-superficie">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-borda bg-superficie-2/60">
            {colunas.map((c) => (
              <th
                key={c.chave}
                scope="col"
                className={cx(
                  'px-4 py-2.5 text-left text-xs font-medium tracking-wide text-texto-3 uppercase',
                  c.ocultarCelular && 'hidden md:table-cell',
                  c.className,
                )}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={chaveLinha(l)}
              onClick={aoClicar ? () => aoClicar(l) : undefined}
              onKeyDown={aoClicar ? (e) => (e.key === 'Enter' ? aoClicar(l) : undefined) : undefined}
              tabIndex={aoClicar ? 0 : undefined}
              className={cx(
                'border-b border-borda last:border-0 transition-colors',
                aoClicar && 'cursor-pointer hover:bg-superficie-2/60 focus-visible:bg-superficie-2',
              )}
            >
              {colunas.map((c) => (
                <td
                  key={c.chave}
                  className={cx('px-4 py-3 text-texto', c.ocultarCelular && 'hidden md:table-cell', c.className)}
                >
                  {c.render(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
