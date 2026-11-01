// Layout da aba Coach: cor de destaque violeta + navegação interna.
// JUNÇÃO: as variáveis --coach-* apontam pros tokens da Base (app/ui); os valores aqui são reserva.
import type { ReactNode } from 'react';
import { NavCoach } from './_componentes/nav';

const estilos = `
.aba-coach{
  --coach-fundo:var(--cor-fundo,#F7F5F0);--coach-cartao:var(--cor-cartao,#FFFFFF);--coach-borda:var(--cor-borda,#E6E2D9);
  --coach-texto:var(--cor-texto,#14161B);--coach-suave:var(--cor-texto-suave,#6B6F78);
  --coach-acento:#7048E8;--coach-acento-suave:rgba(112,72,232,.10);
  --coach-grad:linear-gradient(135deg,#3B5BDB,#7048E8);
  --coach-ok:#2FB37C;--coach-atencao:#E8A93B;--coach-erro:#E5484D;
}
@media (prefers-color-scheme:dark){.aba-coach{
  --coach-fundo:var(--cor-fundo,#0E1116);--coach-cartao:var(--cor-cartao,#151922);--coach-borda:var(--cor-borda,#262B36);
  --coach-texto:var(--cor-texto,#ECEDEF);--coach-suave:var(--cor-texto-suave,#9AA0AB);--coach-acento-suave:rgba(140,108,240,.16);
}}
.aba-coach .num{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:300;font-variant-numeric:tabular-nums}
.aba-coach .titulo-serif{font-family:"Instrument Serif",Georgia,serif;font-style:italic}
@keyframes coach-pulso{0%,100%{opacity:1}50%{opacity:.35}}
.aba-coach .pulso{animation:coach-pulso 1.2s ease-in-out infinite}
`;

export default function LayoutCoach({ children }: { children: ReactNode }) {
  return (
    <div className="aba-coach min-h-full bg-[var(--coach-fundo)] text-[var(--coach-texto)]">
      <style dangerouslySetInnerHTML={{ __html: estilos }} />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <NavCoach />
        {children}
      </div>
    </div>
  );
}
