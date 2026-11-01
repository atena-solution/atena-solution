// Layout da aba Coach: navegação interna. Cores e componentes vêm do design system da Base (app/ui, globals.css).
import type { ReactNode } from 'react';
import { NavCoach } from './_componentes/nav';

export default function LayoutCoach({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full">
      <NavCoach />
      {children}
    </div>
  );
}
