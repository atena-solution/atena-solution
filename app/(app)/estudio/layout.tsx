import type { ReactNode } from 'react';
import { CSS_ESTUDIO } from './_componentes/estilos';
import { NavEstudio } from './_componentes/NavEstudio';

export const metadata = { title: 'Estúdio · ATENA' };

export default function LayoutEstudio({ children }: { children: ReactNode }) {
  return (
    <div className="estudio min-h-full">
      <style>{CSS_ESTUDIO}</style>
      <NavEstudio />
      {children}
    </div>
  );
}
