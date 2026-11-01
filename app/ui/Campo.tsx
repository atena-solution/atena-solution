import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

export const estiloCampo =
  'w-full rounded-[10px] border border-borda bg-superficie px-3 text-sm text-texto placeholder:text-texto-3 ' +
  'transition-colors duration-150 hover:border-borda-forte focus:border-acento-1 focus:outline-none focus:ring-2 focus:ring-acento-1/20 ' +
  'disabled:opacity-60 aria-[invalid=true]:border-erro';

interface Rotulo {
  rotulo?: string;
  ajuda?: string;
  erro?: string;
  icone?: ReactNode;
}

export function EnvolveCampo({ id, rotulo, ajuda, erro, children }: Rotulo & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {rotulo && (
        <label htmlFor={id} className="text-[13px] font-medium text-texto-2">
          {rotulo}
        </label>
      )}
      {children}
      {erro ? (
        <p id={`${id}-erro`} className="text-xs text-erro">
          {erro}
        </p>
      ) : ajuda ? (
        <p id={`${id}-ajuda`} className="text-xs text-texto-3">
          {ajuda}
        </p>
      ) : null}
    </div>
  );
}

export type CampoProps = InputHTMLAttributes<HTMLInputElement> & Rotulo;

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, ajuda, erro, icone, className, id, ...resto },
  ref,
) {
  const gerado = useId();
  const idFinal = id ?? gerado;
  return (
    <EnvolveCampo id={idFinal} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <div className="relative">
        {icone && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-3 [&>svg]:size-4">
            {icone}
          </span>
        )}
        <input
          ref={ref}
          id={idFinal}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? `${idFinal}-erro` : ajuda ? `${idFinal}-ajuda` : undefined}
          className={cx(estiloCampo, 'h-10', icone && 'pl-9', className)}
          {...resto}
        />
      </div>
    </EnvolveCampo>
  );
});

export type AreaTextoProps = TextareaHTMLAttributes<HTMLTextAreaElement> & Rotulo;

export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaTextoProps>(function AreaTexto(
  { rotulo, ajuda, erro, className, id, ...resto },
  ref,
) {
  const gerado = useId();
  const idFinal = id ?? gerado;
  return (
    <EnvolveCampo id={idFinal} rotulo={rotulo} ajuda={ajuda} erro={erro}>
      <textarea
        ref={ref}
        id={idFinal}
        aria-invalid={erro ? true : undefined}
        className={cx(estiloCampo, 'min-h-24 py-2.5 leading-relaxed', className)}
        {...resto}
      />
    </EnvolveCampo>
  );
});
