// Ícones mínimos em traço (evita dependência só para o site).
type P = { className?: string; tamanho?: number };
const base = (t = 18) => ({ width: t, height: t, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const IcoCheck = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M5 12.5 10 17l9-10" /></svg>);
export const IcoSeta = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IcoMenu = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const IcoFechar = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const IcoMais = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M12 5v14M5 12h14" /></svg>);
export const IcoTraco = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M6 12h12" /></svg>);
export const IcoChat = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M4 5h16v11H9l-5 4V5Z" /></svg>);
export const IcoMicrofone = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>);
export const IcoCamera = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" /><circle cx="12" cy="13" r="3.5" /></svg>);
export const IcoCalendario = ({ className, tamanho }: P) => (<svg {...base(tamanho)} className={className}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>);
