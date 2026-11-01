'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Camera, Clapperboard, Images, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CUSTO_CREDITOS } from '@/lib/estudio/creditos';
import type { Criacao } from '@/lib/estudio/tipos';
import { chamar } from './_componentes/cliente';
import { Miniatura } from './_componentes/Miniatura';
import { Cartao, LinkBotao, Titulo, Vazio } from './_componentes/ui';

const FERRAMENTAS = [
  { href: '/estudio/foto', titulo: 'Foto de produto', texto: 'Da foto do celular para foto de catálogo. Produto idêntico.', icone: Camera, custo: `${CUSTO_CREDITOS.foto} créditos por foto` },
  { href: '/estudio/post', titulo: 'Post com a sua marca', texto: 'Arte, título, legenda e hashtags prontos para postar.', icone: Sparkles, custo: `${CUSTO_CREDITOS.post} créditos por post` },
  { href: '/estudio/video', titulo: 'Vídeo curto', texto: 'Vídeo vertical de 5 a 8 s, ou slideshow grátis.', icone: Clapperboard, custo: `${CUSTO_CREDITOS.video} créditos · slideshow grátis` },
  { href: '/estudio/calendario', titulo: 'Calendário do mês', texto: 'A Atena sugere os posts do mês com as datas do seu segmento.', icone: CalendarDays, custo: 'Sugestão grátis' },
];

export default function InicioEstudio() {
  const [recentes, setRecentes] = useState<Criacao[] | null>(null);
  useEffect(() => {
    chamar<{ criacoes: Criacao[] }>('/api/estudio/galeria').then((r) => setRecentes(r.criacoes.slice(0, 8))).catch(() => setRecentes([]));
  }, []);

  return (
    <>
      <Titulo titulo="O que vamos criar hoje?" descricao="Fotos, posts e vídeos profissionais a partir da foto do celular, sempre com a cara da sua marca." />
      <div className="grid sm:grid-cols-2 gap-3">
        {FERRAMENTAS.map(({ href, titulo, texto, icone: Icone, custo }) => (
          <Link key={href} href={href} className="group rounded-[14px] border border-[var(--e-borda)] bg-[var(--e-cartao)] p-5 transition duration-200 hover:border-[var(--e-acento)] hover:-translate-y-0.5">
            <div className="flex items-start gap-4">
              <div className="size-11 shrink-0 rounded-[12px] grid place-items-center bg-[var(--e-acento-fraco)] text-[var(--e-acento)]"><Icone className="size-5" aria-hidden /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-medium">{titulo}</h2>
                  <ArrowRight className="size-4 text-[var(--e-suave)] transition group-hover:translate-x-0.5 group-hover:text-[var(--e-acento)]" aria-hidden />
                </div>
                <p className="text-sm text-[var(--e-suave)] mt-1">{texto}</p>
                <p className="text-xs e-mono text-[var(--e-suave)] mt-3">{custo}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between mt-10 mb-3">
        <h2 className="font-medium">Criados recentemente</h2>
        <Link href="/estudio/galeria" className="text-sm text-[var(--e-suave)] hover:text-[var(--e-texto)]">Ver galeria</Link>
      </div>
      {recentes === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="aspect-square rounded-[12px] e-esqueleto" />)}</div>
      ) : recentes.length === 0 ? (
        <Cartao><Vazio icone={<Images className="size-5" />} titulo="Nada criado ainda" texto="Comece por uma foto de produto: tire uma foto com o celular e a Atena deixa com cara de catálogo." acao={<LinkBotao href="/estudio/foto" variante="principal" icone={<Camera className="size-4" />}>Gerar fotos</LinkBotao>} /></Cartao>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{recentes.map((c) => <Miniatura key={c.id} criacao={c} href={`/estudio/galeria?ver=${c.id}`} />)}</div>
      )}
    </>
  );
}
