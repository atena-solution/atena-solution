'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITENS = [
  { href: '/coach', rotulo: 'Placar' },
  { href: '/coach/gravar', rotulo: 'Gravar' },
  { href: '/coach/roteiro', rotulo: 'Roteiro' },
];

export function NavCoach() {
  const atual = usePathname();
  return (
    <nav aria-label="Coach" className="mb-6 flex items-center gap-1 overflow-x-auto">
      {ITENS.map((i) => {
        const ativo = i.href === '/coach' ? atual === '/coach' : atual?.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativo ? 'page' : undefined}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coach-acento)] ${
              ativo ? 'bg-[var(--coach-acento-suave)] font-medium text-[var(--coach-acento)]' : 'text-[var(--coach-suave)] hover:text-[var(--coach-texto)]'
            }`}
          >
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
