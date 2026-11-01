'use client';
import Link from 'next/link';
import { AlertTriangle, Clapperboard, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { KIT_PADRAO } from '@/lib/estudio/marca';
import { ROTULO_TIPO } from '@/lib/estudio/creditos';
import type { Criacao, KitMarca } from '@/lib/estudio/tipos';
import { Arte } from './Arte';
import { chamar } from './cliente';
import { cx } from './ui';

let kitCache: Promise<KitMarca> | null = null;
export function useKitMarca(): KitMarca | null {
  const [kit, setKit] = useState<KitMarca | null>(null);
  useEffect(() => {
    kitCache ??= chamar<{ kit: KitMarca }>('/api/estudio/marca').then((r) => r.kit).catch(() => KIT_PADRAO);
    kitCache.then(setKit);
  }, []);
  return kit;
}
export function limparCacheKit() {
  kitCache = null;
}

export function ehVideo(url: string) {
  return url.startsWith('data:video') || /\.(mp4|webm)(\?|$)/.test(url);
}

/** Mostra a criação: imagem, arte do post (desenhada) ou vídeo. */
export function Visual({ criacao, className, controles }: { criacao: Criacao; className?: string; controles?: boolean }) {
  const kit = useKitMarca();
  const url = criacao.arquivos[0];
  if (criacao.tipo === 'post' && criacao.arte && kit && criacao.modelo && criacao.formato)
    return <Arte modelo={criacao.modelo} formato={criacao.formato} marca={kit} textos={criacao.arte.textos} fundo={criacao.arte.fundo} fotosReais={criacao.arte.fotosReais} className={cx('size-full object-cover', className)} />;
  if (!url) return null;
  if (ehVideo(url)) return <video src={url} className={cx('size-full object-cover', className)} muted loop playsInline autoPlay={!controles} controls={controles} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={criacao.titulo} className={cx('size-full object-cover', className)} />;
}

export function Miniatura({ criacao, href, aoClicar }: { criacao: Criacao; href?: string; aoClicar?: () => void }) {
  const corpo = (
    <>
      <div className="aspect-square bg-[var(--e-cartao-2)] relative overflow-hidden">
        {criacao.status === 'pronta' ? (
          <Visual criacao={criacao} />
        ) : criacao.status === 'gerando' ? (
          <div className="size-full grid place-items-center e-esqueleto"><Loader2 className="size-5 animate-spin text-[var(--e-suave)]" aria-label="Gerando" /></div>
        ) : (
          <div className="size-full grid place-items-center text-[var(--e-erro)]"><AlertTriangle className="size-5" aria-label="Falhou" /></div>
        )}
        {(criacao.tipo === 'video' || criacao.tipo === 'slideshow') && <Clapperboard className="absolute top-2 right-2 size-4 text-white drop-shadow" aria-hidden />}
        {criacao.arquivos.length > 1 && <span className="absolute bottom-2 right-2 text-[11px] e-mono bg-black/60 text-white rounded-full px-2">+{criacao.arquivos.length - 1}</span>}
      </div>
      <div className="px-3 py-2">
        <div className="text-sm truncate">{criacao.titulo}</div>
        <div className="text-xs text-[var(--e-suave)]">{ROTULO_TIPO[criacao.tipo]}</div>
      </div>
    </>
  );
  const classe = 'block text-left rounded-[12px] overflow-hidden border border-[var(--e-borda)] bg-[var(--e-cartao)] hover:border-[var(--e-acento)] transition duration-150 w-full';
  if (href) return <Link href={href} className={classe}>{corpo}</Link>;
  return <button type="button" onClick={aoClicar} className={classe}>{corpo}</button>;
}
