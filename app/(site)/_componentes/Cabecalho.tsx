'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Logo } from './Logo';
import { IcoFechar, IcoMenu } from './Icones';

const LINKS = [
  { href: '/#produto', rotulo: 'Produto' },
  { href: '/#segmentos', rotulo: 'Segmentos' },
  { href: '/precos', rotulo: 'Preços' },
  { href: '/#perguntas', rotulo: 'Perguntas' },
];

export function Cabecalho() {
  const [aberto, setAberto] = useState(false);
  return (
    <header className="sticky top-0 z-40" style={{ background: 'color-mix(in srgb, var(--s-fundo) 82%, transparent)', backdropFilter: 'saturate(1.4) blur(14px)', borderBottom: '1px solid var(--s-borda)' }}>
      <div className="s-container flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="Início — ATENA SOLUTION"><Logo /></Link>
        <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Principal">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="s-texto-2 transition-colors hover:text-[var(--s-texto)]">{l.rotulo}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/entrar" className="s-btn s-btn-secundario s-btn-pequeno">Entrar</Link>
          <Link href="/cadastro" className="s-btn s-btn-primario s-btn-pequeno">Testar grátis</Link>
        </div>
        <button className="md:hidden p-2 -mr-2" aria-label={aberto ? 'Fechar menu' : 'Abrir menu'} aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
          {aberto ? <IcoFechar tamanho={22} /> : <IcoMenu tamanho={22} />}
        </button>
      </div>
      {aberto && (
        <div className="md:hidden s-container pb-5">
          <nav className="flex flex-col py-2" aria-label="Menu">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setAberto(false)} className="py-3 text-base" style={{ borderBottom: '1px solid var(--s-borda)' }}>{l.rotulo}</Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/entrar" className="s-btn s-btn-secundario">Entrar</Link>
            <Link href="/cadastro" className="s-btn s-btn-primario">Testar grátis</Link>
          </div>
        </div>
      )}
    </header>
  );
}
