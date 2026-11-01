import type { Metadata } from 'next';
import { Cabecalho } from './_componentes/Cabecalho';
import { Rodape } from './_componentes/Rodape';
import './site.css';

// Fontes (Inter, Instrument Serif, JetBrains Mono) já vêm do layout raiz da Base.

export const metadata: Metadata = {
  title: { default: 'ATENA SOLUTION — atendimento, vendas e conteúdo com IA', template: '%s · ATENA SOLUTION' },
  description: 'Atendente de IA no WhatsApp que responde na hora e marca na agenda, coach que dá nota às suas vendas e estúdio de fotos e posts com a sua marca. Teste grátis por 7 dias.',
  openGraph: { locale: 'pt_BR', type: 'website', siteName: 'ATENA SOLUTION' },
};

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 s-btn s-btn-secundario">Pular para o conteúdo</a>
      <Cabecalho />
      <main id="conteudo">{children}</main>
      <Rodape />
    </div>
  );
}
