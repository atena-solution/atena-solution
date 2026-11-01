import type { Metadata } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import { Cabecalho } from './_componentes/Cabecalho';
import { Rodape } from './_componentes/Rodape';
import './site.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['italic', 'normal'], variable: '--font-instrument-serif', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['300', '400'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ATENA SOLUTION — atendimento, vendas e conteúdo com IA', template: '%s · ATENA SOLUTION' },
  description: 'Atendente de IA no WhatsApp que responde na hora e marca na agenda, coach que dá nota às suas vendas e estúdio de fotos e posts com a sua marca. Teste grátis por 7 dias.',
  openGraph: { locale: 'pt_BR', type: 'website', siteName: 'ATENA SOLUTION' },
};

export default function LayoutSite({ children }: { children: React.ReactNode }) {
  return (
    <div className={`site ${inter.variable} ${serif.variable} ${mono.variable}`}>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 s-btn s-btn-secundario">Pular para o conteúdo</a>
      <Cabecalho />
      <main id="conteudo">{children}</main>
      <Rodape />
    </div>
  );
}
