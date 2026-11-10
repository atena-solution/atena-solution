'use client';
// Cartão do Estúdio na tela Início.
import Link from 'next/link';
import { ArrowRight, Camera, Clapperboard, Palette, Sparkles } from 'lucide-react';
import { Cartao, CabecalhoCartao, CorpoCartao, Esqueleto } from '@/app/ui';
import { useDados } from '@/lib/sessao';

export function CartaoEstudioInicio() {
  const { dados, erro } = useDados<{ saldo: number; criacoesMes: number; porTipo: { foto: number; post: number; video: number } }>('/api/estudio/resumo');
  return (
    <Cartao>
      <CabecalhoCartao
        icone={<Palette className="text-estudio" />}
        titulo="Estúdio"
        descricao="Fotos, posts e vídeos com a sua marca"
        acao={
          <Link href="/estudio" className="inline-flex items-center gap-1 text-[13px] font-medium text-acento hover:underline">
            Abrir <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CorpoCartao>
        {erro ? (
          <p className="text-sm text-texto-3">Sem dados do Estúdio.</p>
        ) : !dados ? (
          <Esqueleto className="h-16 w-full" />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><dt className="text-xs text-texto-3">Créditos</dt><dd className="numero text-lg text-texto">{dados.saldo}</dd></div>
              <div><dt className="text-xs text-texto-3">Fotos no mês</dt><dd className="numero text-lg text-texto">{dados.porTipo.foto}</dd></div>
              <div><dt className="text-xs text-texto-3">Posts no mês</dt><dd className="numero text-lg text-texto">{dados.porTipo.post}</dd></div>
              <div><dt className="text-xs text-texto-3">Vídeos no mês</dt><dd className="numero text-lg text-texto">{dados.porTipo.video}</dd></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/estudio/foto" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 text-[13px] font-medium hover:bg-superficie-2"><Camera className="size-3.5 text-estudio" aria-hidden /> Foto de produto</Link>
              <Link href="/estudio/post" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 text-[13px] font-medium hover:bg-superficie-2"><Sparkles className="size-3.5 text-estudio" aria-hidden /> Post</Link>
              <Link href="/estudio/video" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 text-[13px] font-medium hover:bg-superficie-2"><Clapperboard className="size-3.5 text-estudio" aria-hidden /> Vídeo</Link>
            </div>
          </>
        )}
      </CorpoCartao>
    </Cartao>
  );
}
