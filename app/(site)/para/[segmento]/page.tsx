import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SEGMENTOS } from '../../_conteudo';
import { Precos } from '../../_componentes/Precos';
import { ChamadaFinal } from '../../_componentes/ChamadaFinal';
import { Simbolo } from '../../_componentes/Logo';
import { IcoCheck, IcoSeta } from '../../_componentes/Icones';

type Props = { params: Promise<{ segmento: string }> };

export function generateStaticParams() {
  return SEGMENTOS.map((s) => ({ segmento: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { segmento } = await params;
  const s = SEGMENTOS.find((x) => x.slug === segmento);
  return s ? { title: `Para ${s.nome.toLowerCase()}`, description: s.subtitulo } : {};
}

export default async function PaginaSegmento({ params }: Props) {
  const { segmento } = await params;
  const s = SEGMENTOS.find((x) => x.slug === segmento);
  if (!s) notFound();
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="s-hero-brilho" />
        <div className="s-container relative grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="s-sobretitulo">Para {s.nome.toLowerCase()}</p>
            <h1 className="s-titulo-xl mt-4">{s.titulo}</h1>
            <p className="s-texto-2 mt-6 max-w-xl text-lg leading-relaxed">{s.subtitulo}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/cadastro?plano=${s.planoSugerido}`} className="s-btn s-btn-primario">Testar grátis por 7 dias <IcoSeta /></Link>
              <Link href="/precos" className="s-btn s-btn-secundario">Ver preços</Link>
            </div>
          </div>
          <div className="s-card s-card-sombra p-5">
            <p className="s-sobretitulo mb-4 flex items-center gap-2"><Simbolo tamanho={16} /> Exemplo real de conversa</p>
            <div className="grid gap-2" style={{ background: 'var(--s-fundo-2)', borderRadius: 12, padding: 14 }}>
              <div className="s-bolha s-bolha-cliente">{s.exemplo.cliente}</div>
              <div className="s-bolha s-bolha-ia">{s.exemplo.ia}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="s-secao s-divisor" style={{ background: 'var(--s-fundo-2)' }}>
        <div className="s-container">
          <p className="s-sobretitulo">O problema</p>
          <p className="s-titulo-l mt-3 max-w-4xl">“{s.dor}”</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {s.ganhos.map((g) => (
              <div key={g.titulo} className="s-card flex gap-4 p-6">
                <IcoCheck className="s-check" />
                <div>
                  <h3 className="s-titulo-m">{g.titulo}</h3>
                  <p className="s-texto-2 mt-1 text-sm leading-relaxed">{g.texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="s-secao s-divisor">
        <div className="s-container">
          <h2 className="s-titulo-l text-center">Planos</h2>
          <div className="mt-10"><Precos destacar={s.planoSugerido} /></div>
        </div>
      </section>
      <ChamadaFinal plano={s.planoSugerido} />
    </>
  );
}
