import { cx } from './cx';

/** Símbolo da Atena: coruja estilizada em traço fino (desenho próprio). */
export function SimboloAtena({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cx('size-7', className)} aria-hidden>
      <defs>
        <linearGradient id="atena-g" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B5BDB" />
          <stop offset="1" stopColor="#7048E8" />
        </linearGradient>
      </defs>
      {/* cabeça/elmo */}
      <path
        d="M6 9.5 9.5 5l3.2 3.4h6.6L22.5 5 26 9.5v8.2c0 5.8-4.5 10.3-10 10.3S6 23.5 6 17.7V9.5Z"
        stroke="url(#atena-g)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* olhos */}
      <circle cx="11.8" cy="15" r="3.1" stroke="url(#atena-g)" strokeWidth="1.5" />
      <circle cx="20.2" cy="15" r="3.1" stroke="url(#atena-g)" strokeWidth="1.5" />
      <circle cx="11.8" cy="15" r="0.9" fill="url(#atena-g)" />
      <circle cx="20.2" cy="15" r="0.9" fill="url(#atena-g)" />
      {/* bico */}
      <path d="m16 18.2-1.4 2.2L16 22l1.4-1.6L16 18.2Z" fill="url(#atena-g)" />
      {/* penas do peito */}
      <path d="M12.5 24.2c1.1.6 2.3.9 3.5.9s2.4-.3 3.5-.9" stroke="url(#atena-g)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compacto, className }: { compacto?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <SimboloAtena />
      {!compacto && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[0.28em] text-texto">ATENA</span>
          <span className="mt-1 text-[8.5px] font-medium tracking-[0.42em] text-texto-3">SOLUTION</span>
        </span>
      )}
    </span>
  );
}
