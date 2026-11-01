'use client';
// Peças visuais do Coach — finas em cima do design system da Base (app/ui), para o Coach ter a mesma cara das outras abas.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Botao as BotaoBase, Cartao as CartaoBase, Esqueleto as EsqueletoBase, Selo as SeloBase, Vazio as VazioBase, cx, estiloCampo, type TomSelo } from '@/app/ui';

export function Cartao({ titulo, acao, children, className = '' }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <CartaoBase className={cx('p-5', className)}>
      {(titulo || acao) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {titulo && <h2 className="text-[15px] font-semibold tracking-tight text-texto">{titulo}</h2>}
          {acao}
        </header>
      )}
      {children}
    </CartaoBase>
  );
}

type Variante = 'principal' | 'secundario' | 'fantasma' | 'perigo';
const VARIANTE = { principal: 'primario', secundario: 'secundario', fantasma: 'fantasma', perigo: 'perigo' } as const;

export function Botao({ variante = 'secundario', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return <BotaoBase variante={VARIANTE[variante]} {...p} />;
}

const TOM: Record<'neutro' | 'ok' | 'atencao' | 'erro' | 'acento', TomSelo> = { neutro: 'neutro', ok: 'sucesso', atencao: 'atencao', erro: 'erro', acento: 'coach' };
export function Selo({ tom = 'neutro', children }: { tom?: keyof typeof TOM; children: ReactNode }) {
  return <SeloBase tom={TOM[tom]}>{children}</SeloBase>;
}

export function Vazio({ titulo, texto, acao, icone }: { titulo: string; texto: string; acao?: ReactNode; icone?: ReactNode }) {
  return <VazioBase className="rounded-cartao border border-dashed border-borda" icone={icone} titulo={titulo} descricao={texto} acao={acao} />;
}

export function Esqueleto({ className = 'h-24' }: { className?: string }) {
  return <EsqueletoBase className={cx('rounded-cartao', className)} />;
}

export function Aviso({ tom = 'atencao', children }: { tom?: 'atencao' | 'erro' | 'info'; children: ReactNode }) {
  const t = tom === 'erro' ? 'border-erro/30 bg-erro/8' : tom === 'info' ? 'border-acento-1/25 bg-acento-1/8' : 'border-atencao/30 bg-atencao/10';
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={cx('rounded-[10px] border px-4 py-3 text-sm text-texto', t)}>
      {children}
    </div>
  );
}

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-texto-2">{rotulo}</span>
      {children}
      {dica && <span className="text-xs text-texto-3">{dica}</span>}
    </label>
  );
}

/** Classe dos campos (mesma do Campo da Base). */
export const classeEntrada = cx(estiloCampo, 'py-2');

export function Numero({ valor, sufixo, className = '' }: { valor: number | null | undefined; sufixo?: string; className?: string }) {
  return <span className={cx('numero', className)}>{valor === null || valor === undefined ? '—' : `${valor.toLocaleString('pt-BR')}${sufixo ?? ''}`}</span>;
}

/** Cabeçalho de página igual ao das outras abas (app/ui Cabecalho), com volta opcional e selos. */
export function CabecalhoPagina({ titulo, descricao, acoes, voltar, extra }: { titulo: ReactNode; descricao?: ReactNode; acoes?: ReactNode; voltar?: ReactNode; extra?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {voltar}
        <h1 className="text-2xl font-semibold tracking-tight text-texto">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-xl text-sm text-texto-2">{descricao}</p>}
        {extra}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}
