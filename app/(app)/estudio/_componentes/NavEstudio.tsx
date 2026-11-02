'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CalendarDays, Camera, Clapperboard, Coins, Images, LayoutGrid, Palette, Sparkles } from 'lucide-react';
import { chamar } from './cliente';
import { SubNav } from '@/app/ui';

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
  const [saldo, setSaldo] = useState<number | null>(null);

  useEffect(() => {
    chamar<{ saldo: number }>('/api/estudio/creditos').then((r) => setSaldo(r.saldo)).catch(() => setSaldo(null));
    const ouvir = (e: Event) => setSaldo((e as CustomEvent<number>).detail);
    window.addEventListener('estudio:saldo', ouvir);
    return () => window.removeEventListener('estudio:saldo', ouvir);
  }, []);

  return (
    <SubNav
      rotulo="Estúdio"
      itens={ITENS}
      extra={
        <Link href="/estudio/creditos" className="flex h-8 items-center gap-1.5 rounded-full border border-borda bg-superficie px-3 text-sm hover:bg-superficie-2" title="Créditos do Estúdio">
          <Coins className="size-4 text-estudio" aria-hidden />
          <span className="numero">{saldo ?? '—'}</span>
          <span className="sr-only">créditos</span>
        </Link>
      }
    />
  );
}
