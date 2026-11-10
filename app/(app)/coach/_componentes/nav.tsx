'use client';
import { ClipboardList, Mic, Trophy } from 'lucide-react';
import { SubNav } from '@/app/ui';

const ITENS = [
  { href: '/coach', rotulo: 'Placar', icone: Trophy, exato: true },
  { href: '/coach/gravar', rotulo: 'Gravar', icone: Mic },
  { href: '/coach/roteiro', rotulo: 'Roteiro', icone: ClipboardList },
];

export function NavCoach() {
  return <SubNav rotulo="Coach" itens={ITENS} />;
}
