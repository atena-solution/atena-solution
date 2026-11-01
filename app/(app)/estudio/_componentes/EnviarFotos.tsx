'use client';
import { ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { prepararFoto } from './cliente';
import { cx } from './ui';

/** Área para subir fotos do celular (câmera ou galeria), com prévia e remoção. */
export function EnviarFotos({ fotos, aoMudar, max = 5, rotulo = 'Fotos do produto', dica = 'Fotos reais, boa luz, produto inteiro. De 1 a 5.', nomes }: { fotos: string[]; aoMudar: (f: string[]) => void; max?: number; rotulo?: string; dica?: string; nomes?: string[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState('');
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  async function adicionar(lista: FileList | null) {
    if (!lista?.length) return;
    setErro('');
    setLendo(true);
    try {
      const novos = await Promise.all([...lista].slice(0, max - fotos.length).map((f) => prepararFoto(f)));
      aoMudar([...fotos, ...novos].slice(0, max));
      if (lista.length > max - fotos.length) setErro(`No máximo ${max} foto${max === 1 ? '' : 's'}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu para ler a foto.');
    } finally {
      setLendo(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div>
      <div className="mb-2">
        <div className="text-sm font-medium">{rotulo}</div>
        <div className="text-xs text-[var(--e-suave)]">{dica}</div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {fotos.map((f, i) => (
          <div key={i} className="relative aspect-square rounded-[12px] overflow-hidden border border-[var(--e-borda)] bg-[var(--e-cartao-2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f} alt={nomes?.[i] ?? `Foto ${i + 1}`} className="size-full object-cover" />
            {nomes?.[i] && <span className="absolute left-1.5 bottom-1.5 rounded-full bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5">{nomes[i]}</span>}
            <button type="button" onClick={() => aoMudar(fotos.filter((_, j) => j !== i))} className="absolute top-1.5 right-1.5 size-7 grid place-items-center rounded-full bg-black/55 text-white hover:bg-black/75" aria-label={`Remover foto ${i + 1}`}>
              <X className="size-4" />
            </button>
          </div>
        ))}
        {fotos.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); void adicionar(e.dataTransfer.files); }}
            className={cx('aspect-square rounded-[12px] border border-dashed grid place-items-center text-center p-2 transition', arrastando ? 'border-[var(--e-acento)] bg-[var(--e-acento-fraco)]' : 'border-[var(--e-borda)] hover:bg-[var(--e-cartao-2)]')}
          >
            <span className="flex flex-col items-center gap-1 text-xs text-[var(--e-suave)]">
              <ImagePlus className={cx('size-6', lendo && 'animate-pulse')} aria-hidden />
              {lendo ? 'Lendo…' : nomes?.[fotos.length] ? `Foto "${nomes[fotos.length]}"` : 'Adicionar foto'}
            </span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple={max > 1} className="sr-only" tabIndex={-1} onChange={(e) => void adicionar(e.target.files)} />
      {erro && <p className="text-xs text-[var(--e-erro)] mt-2" role="alert">{erro}</p>}
    </div>
  );
}
