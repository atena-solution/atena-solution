'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CalendarDays, Camera, Clapperboard, Coins, Images, LayoutGrid, Palette, Sparkles } from 'lucide-react';
import { chamar } from './cliente';
import { cx } from './ui';

const ITENS = [
  { href: '/estudio', rotulo: 'Visão geral', icone: LayoutGrid, exato: true },
  { href: '/estudio/foto', rotulo: 'Foto', icone: Camera },
  { href: '/estudio/post', rotulo: 'Post', icone: Sparkles },
  { href: '/estudio/video', rotulo: 'Vídeo', icone: Clapperboard },
  { href: '/estudio/calendario', rotulo: 'Calendário', icone: CalendarDays },
  { href: '/estudio/galeria', rotulo: 'Galeria', icone: Images },
  { href: '/estudio/marca', rotulo: 'Marca', icone: Palette },
];

export function NavEstudio() {
  const caminho = usePathname();
  const [saldo, setSaldo] = useState<number | null>(null);

  useEffect(() => {
    chamar<{ saldo: number }>('/api/estudio/creditos').then((r) => setSaldo(r.saldo)).catch(() => setSaldo(null));
    const ouvir = (e: Event) => setSaldo((e as CustomEvent<number>).detail);
    window.addEventListener('estudio:saldo', ouvir);
    return () => window.removeEventListener('estudio:saldo', ouvir);
  }, []);

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--e-borda)] bg-[var(--e-fundo)]/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center gap-3 h-14">
        <span className="hidden sm:flex items-center gap-2 pr-3 mr-1 border-r border-[var(--e-borda)]">
          <span className="size-2 rounded-full bg-[var(--e-acento)]" aria-hidden />
          <span className="text-sm font-semibold tracking-[0.18em]">ESTÚDIO</span>
        </span>
        <nav aria-label="Estúdio" className="flex-1 overflow-x-auto [scrollbar-width:none] -mx-1">
          <ul className="flex gap-1 px-1 w-max">
            {ITENS.map(({ href, rotulo, icone: Icone, exato }) => {
              const ativo = exato ? caminho === href : caminho?.startsWith(href);
              return (
                <li key={href}>
                  <Link href={href} aria-current={ativo ? 'page' : undefined} className={cx('flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm transition duration-150 whitespace-nowrap', ativo ? 'bg-[var(--e-acento-fraco)] text-[var(--e-texto)] font-medium' : 'text-[var(--e-suave)] hover:text-[var(--e-texto)] hover:bg-[var(--e-cartao-2)]')}>
                    <Icone className={cx('size-4', ativo && 'text-[var(--e-acento)]')} aria-hidden />
                    {rotulo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link href="/estudio/creditos" className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full border border-[var(--e-borda)] text-sm hover:bg-[var(--e-cartao-2)]" title="Créditos do Estúdio">
          <Coins className="size-4 text-[var(--e-acento)]" aria-hidden />
          <span className="e-mono">{saldo ?? '—'}</span>
          <span className="sr-only">créditos</span>
        </Link>
      </div>
    </div>
  );
}
