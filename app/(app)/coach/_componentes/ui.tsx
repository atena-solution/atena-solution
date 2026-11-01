'use client';
// Peças visuais do Coach. JUNÇÃO: trocar pelos componentes de app/ui da Base (Botão, Cartão, Selo, Vazio).
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Cartao({ titulo, acao, children, className = '' }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-[var(--coach-borda)] bg-[var(--coach-cartao)] p-5 ${className}`}>
      {(titulo || acao) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-sm font-medium text-[var(--coach-suave)]">{titulo}</h2>}
          {acao}
        </header>
      )}
      {children}
    </section>
  );
}

type Variante = 'principal' | 'secundario' | 'fantasma' | 'perigo';
export function Botao({ variante = 'secundario', carregando, children, className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2 text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coach-acento)]';
  const v: Record<Variante, string> = {
    principal: 'text-white [background:var(--coach-grad)] hover:brightness-110',
    secundario: 'border border-[var(--coach-borda)] bg-[var(--coach-cartao)] hover:border-[var(--coach-acento)]',
    fantasma: 'text-[var(--coach-suave)] hover:text-[var(--coach-texto)]',
    perigo: 'text-white bg-[var(--coach-erro)] hover:brightness-110',
  };
  return (
    <button {...p} disabled={p.disabled || carregando} className={`${base} ${v[variante]} ${className}`}>
      {carregando && <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function Selo({ tom = 'neutro', children }: { tom?: 'neutro' | 'ok' | 'atencao' | 'erro' | 'acento'; children: ReactNode }) {
  const t = {
    neutro: 'bg-[var(--coach-borda)] text-[var(--coach-texto)]',
    ok: 'bg-[color-mix(in_srgb,var(--coach-ok)_16%,transparent)] text-[var(--coach-ok)]',
    atencao: 'bg-[color-mix(in_srgb,var(--coach-atencao)_18%,transparent)] text-[#a8741a] dark:text-[var(--coach-atencao)]',
    erro: 'bg-[color-mix(in_srgb,var(--coach-erro)_14%,transparent)] text-[var(--coach-erro)]',
    acento: 'bg-[var(--coach-acento-suave)] text-[var(--coach-acento)]',
  }[tom];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-[var(--coach-borda)] px-6 py-10 text-center">
      <p className="font-medium">{titulo}</p>
      <p className="max-w-md text-sm text-[var(--coach-suave)]">{texto}</p>
      {acao && <div className="mt-2">{acao}</div>}
    </div>
  );
}

export function Esqueleto({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[14px] bg-[var(--coach-borda)] opacity-60 ${className}`} />;
}

export function Aviso({ tom = 'atencao', children }: { tom?: 'atencao' | 'erro' | 'info'; children: ReactNode }) {
  const cor = tom === 'erro' ? 'var(--coach-erro)' : tom === 'info' ? 'var(--coach-acento)' : 'var(--coach-atencao)';
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className="rounded-[10px] border px-4 py-3 text-sm" style={{ borderColor: cor, background: `color-mix(in srgb, ${cor} 8%, transparent)` }}>
      {children}
    </div>
  );
}

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{rotulo}</span>
      {children}
      {dica && <span className="text-xs text-[var(--coach-suave)]">{dica}</span>}
    </label>
  );
}

export const classeEntrada =
  'w-full rounded-[10px] border border-[var(--coach-borda)] bg-[var(--coach-cartao)] px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--coach-acento)]';

export function Numero({ valor, sufixo, className = '' }: { valor: number | null | undefined; sufixo?: string; className?: string }) {
  return <span className={`num ${className}`}>{valor === null || valor === undefined ? '—' : `${valor.toLocaleString('pt-BR')}${sufixo ?? ''}`}</span>;
}
