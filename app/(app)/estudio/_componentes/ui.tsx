'use client';
// Peças visuais do Estúdio. Na junção, trocar pelos componentes de app/ui quando equivalentes.
import Link from 'next/link';
import { type ButtonHTMLAttributes, type ReactNode, useId } from 'react';
import { Loader2 } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variante = 'principal' | 'secundario' | 'fantasma' | 'perigo';
const VAR: Record<Variante, string> = {
  principal: 'text-white bg-[linear-gradient(135deg,var(--e-primaria-1),var(--e-primaria-2))] hover:brightness-110 shadow-[0_1px_0_rgba(255,255,255,.15)_inset]',
  secundario: 'bg-[var(--e-cartao)] border border-[var(--e-borda)] hover:bg-[var(--e-cartao-2)]',
  fantasma: 'hover:bg-[var(--e-cartao-2)] text-[var(--e-suave)] hover:text-[var(--e-texto)]',
  perigo: 'text-[var(--e-erro)] border border-[var(--e-borda)] hover:bg-[rgba(229,72,77,.08)]',
};

export function Botao({ variante = 'principal', carregando, icone, children, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode }) {
  return (
    <button
      {...p}
      disabled={p.disabled || carregando}
      className={cx('inline-flex items-center justify-center gap-2 rounded-[10px] px-4 h-10 text-sm font-medium transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed', VAR[variante], className)}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
}

export function LinkBotao({ href, variante = 'secundario', children, className, icone }: { href: string; variante?: Variante; children: ReactNode; className?: string; icone?: ReactNode }) {
  return (
    <Link href={href} className={cx('inline-flex items-center justify-center gap-2 rounded-[10px] px-4 h-10 text-sm font-medium transition duration-150', VAR[variante], className)}>
      {icone}
      {children}
    </Link>
  );
}

export function Cartao({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={cx('rounded-[14px] border border-[var(--e-borda)] bg-[var(--e-cartao)]', className)}>{children}</Tag>;
}

export function Titulo({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] leading-tight"><span className="e-serif">{titulo}</span></h1>
        {descricao && <p className="text-sm text-[var(--e-suave)] mt-1 max-w-xl">{descricao}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Rotulo({ children, dica }: { children: ReactNode; dica?: string }) {
  return (
    <div className="mb-2">
      <div className="text-sm font-medium">{children}</div>
      {dica && <div className="text-xs text-[var(--e-suave)]">{dica}</div>}
    </div>
  );
}

export function Campo({ rotulo, dica, erro, valor, aoMudar, placeholder, multilinha, max, tipo = 'text' }: { rotulo: string; dica?: string; erro?: string; valor: string; aoMudar: (v: string) => void; placeholder?: string; multilinha?: boolean; max?: number; tipo?: string }) {
  const id = useId();
  const classe = cx('w-full rounded-[10px] border bg-[var(--e-cartao)] px-3 text-sm placeholder:text-[var(--e-suave)]/70 outline-none focus:border-[var(--e-foco)] transition', erro ? 'border-[var(--e-erro)]' : 'border-[var(--e-borda)]');
  return (
    <label htmlFor={id} className="block">
      <span className="block text-sm font-medium mb-1.5">{rotulo}</span>
      {multilinha ? (
        <textarea id={id} value={valor} maxLength={max} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} rows={4} className={cx(classe, 'py-2.5 resize-y')} aria-invalid={!!erro} />
      ) : (
        <input id={id} type={tipo} value={valor} maxLength={max} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} className={cx(classe, 'h-10')} aria-invalid={!!erro} />
      )}
      {(erro || dica) && <span className={cx('block text-xs mt-1', erro ? 'text-[var(--e-erro)]' : 'text-[var(--e-suave)]')}>{erro || dica}</span>}
    </label>
  );
}

/** Grupo de opções em cartões (radio acessível). */
export function Opcoes<T extends string>({ rotulo, dica, opcoes, valor, aoMudar, colunas = 'grid-cols-2 sm:grid-cols-3' }: { rotulo: string; dica?: string; opcoes: { valor: T; titulo: string; descricao?: string; icone?: ReactNode; desabilitado?: boolean }[]; valor: T; aoMudar: (v: T) => void; colunas?: string }) {
  const nome = useId();
  return (
    <fieldset>
      <legend className="sr-only">{rotulo}</legend>
      <Rotulo dica={dica}>{rotulo}</Rotulo>
      <div className={cx('grid gap-2', colunas)}>
        {opcoes.map((o) => {
          const ativo = o.valor === valor;
          return (
            <label key={o.valor} className={cx('relative cursor-pointer rounded-[12px] border p-3 transition duration-150', ativo ? 'border-[var(--e-acento)] bg-[var(--e-acento-fraco)]' : 'border-[var(--e-borda)] hover:bg-[var(--e-cartao-2)]', o.desabilitado && 'opacity-50 cursor-not-allowed')}>
              <input type="radio" name={nome} value={o.valor} checked={ativo} disabled={o.desabilitado} onChange={() => aoMudar(o.valor)} className="sr-only peer" />
              <span className="flex items-center gap-2 text-sm font-medium">{o.icone}{o.titulo}</span>
              {o.descricao && <span className="block text-xs text-[var(--e-suave)] mt-0.5">{o.descricao}</span>}
              <span className="pointer-events-none absolute inset-0 rounded-[12px] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--e-foco)]" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Selo({ children, tom = 'neutro' }: { children: ReactNode; tom?: 'neutro' | 'acento' | 'ok' | 'erro' }) {
  const t = { neutro: 'bg-[var(--e-cartao-2)] text-[var(--e-suave)]', acento: 'bg-[var(--e-acento-fraco)] text-[#B07818] dark:text-[var(--e-acento)]', ok: 'bg-[rgba(47,179,124,.14)] text-[#1F8A5E]', erro: 'bg-[rgba(229,72,77,.12)] text-[var(--e-erro)]' }[tom];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', t)}>{children}</span>;
}

export function Vazio({ icone, titulo, texto, acao }: { icone: ReactNode; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="size-12 rounded-full grid place-items-center bg-[var(--e-acento-fraco)] text-[var(--e-acento)] mb-4">{icone}</div>
      <h3 className="font-medium">{titulo}</h3>
      <p className="text-sm text-[var(--e-suave)] mt-1 max-w-sm">{texto}</p>
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Aviso({ tom = 'erro', children }: { tom?: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  const t = { erro: 'border-[rgba(229,72,77,.35)] bg-[rgba(229,72,77,.06)]', ok: 'border-[rgba(47,179,124,.35)] bg-[rgba(47,179,124,.06)]', info: 'border-[var(--e-borda)] bg-[var(--e-cartao-2)]' }[tom];
  return <div role={tom === 'erro' ? 'alert' : 'status'} className={cx('rounded-[12px] border px-4 py-3 text-sm', t)}>{children}</div>;
}

export function Custo({ creditos, saldo }: { creditos: number; saldo?: number | null }) {
  const falta = saldo != null && saldo < creditos;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--e-suave)]">Custo</span>
      <span className={cx('e-mono', falta && 'text-[var(--e-erro)]')}>
        {creditos === 0 ? 'Grátis' : `${creditos} crédito${creditos === 1 ? '' : 's'}`}
        {saldo != null && <span className="text-[var(--e-suave)]"> · saldo {saldo}</span>}
      </span>
    </div>
  );
}
