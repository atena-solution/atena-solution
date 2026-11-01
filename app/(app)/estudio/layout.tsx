import type { ReactNode } from 'react';
import { CSS_ESTUDIO } from './_componentes/estilos';
import { NavEstudio } from './_componentes/NavEstudio';

export const metadata = { title: 'Estúdio · ATENA' };

export default function LayoutEstudio({ children }: { children: ReactNode }) {
  return (
    <div className="estudio min-h-full">
      <style>{CSS_ESTUDIO}</style>
      <NavEstudio />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">{children}</div>
    </div>
  );
}
