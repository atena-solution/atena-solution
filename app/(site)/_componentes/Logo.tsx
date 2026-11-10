// Símbolo da Atena: coruja/elmo estilizado em traço fino (SVG próprio).
export function Simbolo({ tamanho = 28, className }: { tamanho?: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="atena-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B5BDB" />
          <stop offset="1" stopColor="#7048E8" />
        </linearGradient>
      </defs>
      {/* contorno do elmo / cabeça da coruja */}
      <path d="M16 3.5c-6.6 0-11 4.6-11 10.6 0 6.7 4.6 12.2 11 14.4 6.4-2.2 11-7.7 11-14.4C27 8.1 22.6 3.5 16 3.5Z" stroke="url(#atena-g)" strokeWidth="1.4" />
      {/* tufos / crista */}
      <path d="M9 6.8 7.2 3.6M23 6.8l1.8-3.2" stroke="url(#atena-g)" strokeWidth="1.4" strokeLinecap="round" />
      {/* olhos */}
      <circle cx="11.6" cy="14" r="3.2" stroke="url(#atena-g)" strokeWidth="1.4" />
      <circle cx="20.4" cy="14" r="3.2" stroke="url(#atena-g)" strokeWidth="1.4" />
      <circle cx="11.6" cy="14" r="0.9" fill="url(#atena-g)" />
      <circle cx="20.4" cy="14" r="0.9" fill="url(#atena-g)" />
      {/* bico / nasal do elmo */}
      <path d="M16 15.5v6.2M14.4 20.2 16 22.4l1.6-2.2" stroke="url(#atena-g)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ compacto = false }: { compacto?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="ATENA SOLUTION">
      <Simbolo />
      <span className="flex flex-col leading-none">
        <span style={{ letterSpacing: '0.32em', fontWeight: 600, fontSize: 15 }}>ATENA</span>
        {!compacto && <span style={{ letterSpacing: '0.42em', fontSize: 8.5, marginTop: 3, color: 'var(--s-texto-3)' }}>SOLUTION</span>}
      </span>
    </span>
  );
}
