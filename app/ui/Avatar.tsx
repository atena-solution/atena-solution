import { cx } from './cx';
import { iniciais } from '@/lib/ui/formato';

const tamanhos = { p: 'size-7 text-[11px]', m: 'size-9 text-[13px]', g: 'size-12 text-base' };

/** Cores estáveis por nome, para o mesmo cliente ter sempre a mesma cor. */
const paleta = ['#3B5BDB', '#7048E8', '#0F9B8E', '#D08A1F', '#C2255C', '#1C7ED6', '#5C940D'];

function corPorNome(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return paleta[h % paleta.length];
}

export function Avatar({
  nome,
  fotoUrl,
  tamanho = 'm',
  className,
}: {
  nome: string;
  fotoUrl?: string;
  tamanho?: keyof typeof tamanhos;
  className?: string;
}) {
  if (fotoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={fotoUrl} alt={nome} className={cx('rounded-full object-cover', tamanhos[tamanho], className)} />;
  }
  const cor = corPorNome(nome || '?');
  return (
    <span
      role="img"
      aria-label={nome}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', tamanhos[tamanho], className)}
      style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, color: cor }}
    >
      {iniciais(nome)}
    </span>
  );
}
