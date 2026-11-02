'use client';
// Peças visuais do Estúdio — em cima do design system da Base (app/ui): mesmos botões, cartões, selos e cabeçalho.
import Link from 'next/link';
import { type ButtonHTMLAttributes, type ReactNode, useId } from 'react';
import { Botao as BotaoBase, Cabecalho, Selo as SeloBase, Vazio as VazioBase, cx } from '@/app/ui';

export { cx } from '@/app/ui';

type Variante = 'principal' | 'secundario' | 'fantasma' | 'perigo';
const VARIANTE = { principal: 'primario', secundario: 'secundario', fantasma: 'fantasma', perigo: 'perigo' } as const;
// mesmas classes do Botao da Base, para o LinkBotao ficar idêntico ao botão
const CLASSE_LINK: Record<Variante, string> = {
  principal: 'gradiente-atena text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset] hover:brightness-110',
  secundario: 'bg-superficie text-texto border border-borda hover:border-borda-forte hover:bg-superficie-2',
  fantasma: 'text-texto-2 hover:text-texto hover:bg-superficie-2',
  perigo: 'bg-erro text-white hover:brightness-110',
};

export function Botao({ variante = 'principal', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode }) {
  return <BotaoBase variante={VARIANTE[variante]} {...p} />;
}

export function LinkBotao({ href, variante = 'secundario', children, className, icone }: { href: string; variante?: Variante; children: ReactNode; className?: string; icone?: ReactNode }) {
  return (
    <Link href={href} className={cx('inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium whitespace-nowrap transition-all duration-150', CLASSE_LINK[variante], className)}>
      {icone}
      {children}
    </Link>
  );
}

export function Cartao({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={cx('min-w-0 rounded-cartao border border-borda bg-superficie shadow-[var(--sombra)]', className)}>{children}</Tag>;
}

/** Cabeçalho de página: o mesmo da Base (app/ui Cabecalho). */
export function Titulo({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return <Cabecalho titulo={titulo} descricao={descricao} acoes={acao} />;
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

const TOM = { neutro: 'neutro', acento: 'estudio', ok: 'sucesso', erro: 'erro' } as const;
export function Selo({ children, tom = 'neutro' }: { children: ReactNode; tom?: keyof typeof TOM }) {
  return <SeloBase tom={TOM[tom]}>{children}</SeloBase>;
}

export function Vazio({ icone, titulo, texto, acao }: { icone: ReactNode; titulo: string; texto: string; acao?: ReactNode }) {
  return <VazioBase icone={icone} titulo={titulo} descricao={texto} acao={acao} />;
}

export function Aviso({ tom = 'erro', children }: { tom?: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  const t = { erro: 'border-erro/30 bg-erro/8', ok: 'border-sucesso/30 bg-sucesso/8', info: 'border-borda bg-superficie-2' }[tom];
  return <div role={tom === 'erro' ? 'alert' : 'status'} className={cx('rounded-[10px] border px-4 py-3 text-sm text-texto', t)}>{children}</div>;
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
