import { cx } from './cx';

export function Esqueleto({ className }: { className?: string }) {
  return <div aria-hidden className={cx('esqueleto rounded-lg', className ?? 'h-4 w-full')} />;
}

export function EsqueletoLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Esqueleto className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Esqueleto className="h-3.5 w-1/3" />
            <Esqueleto className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
