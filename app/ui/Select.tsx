import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cx } from './cx';
import { EnvolveCampo, estiloCampo } from './Campo';

export interface Opcao {
  valor: string;
  rotulo: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo?: string;
  ajuda?: string;
  erro?: string;
  opcoes: Opcao[];
  vazio?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { rotulo, ajuda, erro, opcoes, vazio, className, id, ...resto },
  ref,
) {
  const gerado = useId();
  const idFinal = id ?? gerado;
  return (
    <EnvolveCampo id={idFinal} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <div className="relative">
        <select
          ref={ref}
          id={idFinal}
          aria-invalid={erro ? true : undefined}
          className={cx(estiloCampo, 'h-10 appearance-none pr-9', className)}
          {...resto}
        >
          {vazio && <option value="">{vazio}</option>}
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-texto-3" aria-hidden />
      </div>
    </EnvolveCampo>
  );
});
