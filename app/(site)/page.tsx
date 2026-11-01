import Link from 'next/link';
import { ABAS, COMO_FUNCIONA, HERO, NUMEROS, SEGMENTOS } from './_conteudo';
import { DemoConversa } from './_componentes/DemoConversa';
import { Precos } from './_componentes/Precos';
import { Perguntas } from './_componentes/Perguntas';
import { ChamadaFinal } from './_componentes/ChamadaFinal';
import { IcoCamera, IcoChat, IcoCheck, IcoMicrofone, IcoSeta } from './_componentes/Icones';

const ICONE_ABA = { atendimento: IcoChat, coach: IcoMicrofone, estudio: IcoCamera } as const;

export default function PaginaInicial() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="s-hero-brilho" />
        <div className="s-container relative grid items-center gap-14 pb-24 pt-14 md:pt-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="s-selo"><span className="s-ponto-vivo" /> {HERO.selo}</span>
            <h1 className="s-titulo-xl mt-6">
              {HERO.titulo[0]}<br /><span className="s-degrade-texto">{HERO.titulo[1]}</span>
            </h1>
            <p className="s-texto-2 mt-6 max-w-xl text-lg leading-relaxed">{HERO.subtitulo}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/cadastro" className="s-btn s-btn-primario">{HERO.ctaPrincipal} <IcoSeta /></Link>
              <Link href="#produto" className="s-btn s-btn-secundario">{HERO.ctaSecundario}</Link>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm s-texto-3">
              {HERO.provas.map((p) => <li key={p} className="flex items-center gap-1.5"><IcoCheck className="s-check" tamanho={16} />{p}</li>)}
            </ul>
          </div>
          <DemoConversa />
        </div>
      </section>

      {/* NÚMEROS */}
      <section className="s-divisor">
        <div className="s-container grid gap-8 py-12 md:grid-cols-3">
          {NUMEROS.map((n) => (
            <div key={n.valor}>
              <p className="s-mono text-3xl">{n.valor}</p>
              <p className="s-texto-2 mt-1 text-sm">{n.rotulo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AS 3 ABAS */}
      <section id="produto" className="s-secao s-divisor scroll-mt-16">
        <div className="s-container">
          <p className="s-sobretitulo">Uma plataforma, três abas</p>
          <h2 className="s-titulo-l mt-3 max-w-3xl">Contrate o que precisa. <span className="s-texto-3">Junte quando quiser.</span></h2>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {ABAS.map((a) => {
              const Ico = ICONE_ABA[a.id as keyof typeof ICONE_ABA];
              return (
                <article key={a.id} className="s-card flex flex-col p-7">
                  <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${a.cor} 14%, transparent)`, color: a.cor }}><Ico tamanho={22} /></span>
                  <p className="s-sobretitulo mt-6" style={{ color: a.cor }}>{a.nome}</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">{a.titulo}</h3>
                  <p className="s-texto-2 mt-3 text-[0.95rem] leading-relaxed">{a.texto}</p>
                  <ul className="mt-6 grid gap-2 text-sm">
                    {a.itens.map((i) => <li key={i} className="flex gap-2.5"><IcoCheck className="s-check" />{i}</li>)}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="s-secao s-divisor" style={{ background: 'var(--s-fundo-2)' }}>
        <div className="s-container">
          <p className="s-sobretitulo">Como funciona</p>
          <h2 className="s-titulo-l mt-3">Pronto para atender em 15 minutos.</h2>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {COMO_FUNCIONA.map((c) => (
              <li key={c.n} className="s-card p-7">
                <span className="s-mono text-sm s-texto-3">0{c.n}</span>
                <h3 className="s-titulo-m mt-4">{c.titulo}</h3>
                <p className="s-texto-2 mt-2 text-sm leading-relaxed">{c.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* SEGMENTOS */}
      <section id="segmentos" className="s-secao s-divisor scroll-mt-16">
        <div className="s-container">
          <p className="s-sobretitulo">Feita para quem atende gente</p>
          <h2 className="s-titulo-l mt-3 max-w-3xl">Clínicas, barbearias, imobiliárias, lojas, escolas e agências.</h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SEGMENTOS.map((s) => (
              <Link key={s.slug} href={`/para/${s.slug}`} className="s-card group flex flex-col p-6 transition-colors hover:border-[var(--s-borda-forte)]">
                <h3 className="s-titulo-m">{s.nome}</h3>
                <p className="s-texto-2 mt-2 flex-1 text-sm leading-relaxed">{s.titulo}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold">Ver como funciona <IcoSeta tamanho={16} className="transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="s-secao s-divisor scroll-mt-16">
        <div className="s-container">
          <div className="text-center">
            <p className="s-sobretitulo">Preços</p>
            <h2 className="s-titulo-l mt-3">Simples, sem fidelidade.</h2>
            <p className="s-texto-2 mx-auto mt-3 max-w-xl">7 dias grátis com tudo liberado. Depois, escolha a aba ou o pacote.</p>
          </div>
          <div className="mt-10"><Precos /></div>
          <p className="mt-8 text-center text-sm"><Link href="/precos" className="font-semibold underline underline-offset-4">Ver a comparação completa e os créditos do Estúdio</Link></p>
        </div>
      </section>

      {/* PERGUNTAS */}
      <section id="perguntas" className="s-secao s-divisor scroll-mt-16">
        <div className="s-container grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="s-sobretitulo">Perguntas frequentes</p>
            <h2 className="s-titulo-l mt-3">Tudo o que perguntam antes de começar.</h2>
          </div>
          <Perguntas />
        </div>
      </section>

      <ChamadaFinal />
    </>
  );
}
