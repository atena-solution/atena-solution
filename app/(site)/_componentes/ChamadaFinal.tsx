import Link from 'next/link';
import { CTA_FINAL } from '../_conteudo';
import { IcoSeta } from './Icones';

export function ChamadaFinal({ plano }: { plano?: string }) {
  return (
    <section className="s-secao">
      <div className="s-container">
        <div className="relative overflow-hidden rounded-[22px] px-6 py-16 text-center text-white md:px-16" style={{ background: 'linear-gradient(135deg, #1b2440 0%, #2a1f5c 55%, #3b2a86 100%)' }}>
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(500px 220px at 80% 0%, rgba(112,72,232,.45), transparent 70%)' }} />
          <h2 className="s-titulo-l relative mx-auto max-w-3xl">{CTA_FINAL.titulo}</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/75">{CTA_FINAL.texto}</p>
          <Link href={plano ? `/cadastro?plano=${plano}` : '/cadastro'} className="s-btn relative mt-8 bg-white text-[#12151b] hover:bg-white/90">
            {CTA_FINAL.botao} <IcoSeta />
          </Link>
        </div>
      </div>
    </section>
  );
}
