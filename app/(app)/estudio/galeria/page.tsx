'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Clapperboard, Copy, Download, Images, Search, Sparkles, Trash2, X } from 'lucide-react';
import { ROTULO_TIPO } from '@/lib/estudio/creditos';
import { FORMATOS } from '@/lib/estudio/prompts';
import { nomeArquivo } from '@/lib/estudio/galeria';
import { legendaCompleta } from '@/lib/estudio/legenda';
import type { Criacao, Formato, TipoCriacao } from '@/lib/estudio/tipos';
import { Arte, type ArteRef } from '../_componentes/Arte';
import { baixar, chamar, paraPng } from '../_componentes/cliente';
import { Miniatura, useKitMarca, ehVideo } from '../_componentes/Miniatura';
import { Botao, Cartao, LinkBotao, Selo, Titulo, Vazio, cx } from '../_componentes/ui';

const FILTROS: { valor: TipoCriacao | 'todos'; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Tudo' },
  { valor: 'foto', rotulo: 'Fotos' },
  { valor: 'post', rotulo: 'Posts' },
  { valor: 'video', rotulo: 'Vídeos' },
  { valor: 'slideshow', rotulo: 'Slideshows' },
];

export default function GaleriaPage() {
  const [tipo, setTipo] = useState<TipoCriacao | 'todos'>('todos');
  const [formato, setFormato] = useState<Formato | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<Criacao[] | null>(null);
  const [aberta, setAberta] = useState<Criacao | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams({ tipo, formato, busca });
      chamar<{ criacoes: Criacao[] }>(`/api/estudio/galeria?${q}`).then((r) => setLista(r.criacoes)).catch(() => setLista([]));
    }, busca ? 250 : 0);
    return () => clearTimeout(t);
  }, [tipo, formato, busca]);

  useEffect(() => {
    const ver = new URLSearchParams(location.search).get('ver');
    if (ver) chamar<{ criacao: Criacao }>(`/api/estudio/galeria/${ver}`).then((r) => setAberta(r.criacao)).catch(() => {});
  }, []);

  async function apagar(c: Criacao) {
    if (!confirm('Apagar esta criação da galeria? Não dá para desfazer.')) return;
    await chamar(`/api/estudio/galeria/${c.id}`, { metodo: 'DELETE' });
    setLista((l) => l?.filter((x) => x.id !== c.id) ?? null);
    setAberta(null);
  }

  return (
    <>
      <Titulo titulo="Galeria" descricao="Tudo o que a sua empresa criou no Estúdio. Baixe, copie a legenda ou reaproveite em um novo post ou vídeo." />
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="group" aria-label="Filtrar por tipo">
          {FILTROS.map((f) => (
            <button key={f.valor} aria-pressed={tipo === f.valor} onClick={() => setTipo(f.valor)} className={cx('h-9 px-3 rounded-full text-sm border whitespace-nowrap transition', tipo === f.valor ? 'border-[var(--e-acento)] bg-[var(--e-acento-fraco)] font-medium' : 'border-[var(--e-borda)] text-[var(--e-suave)] hover:text-[var(--e-texto)]')}>{f.rotulo}</button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <select value={formato} onChange={(e) => setFormato(e.target.value as Formato | 'todos')} aria-label="Formato" className="h-9 rounded-[10px] border border-[var(--e-borda)] bg-[var(--e-cartao)] px-2 text-sm">
            <option value="todos">Todos os formatos</option>
            {(Object.keys(FORMATOS) as Formato[]).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <label className="relative flex-1 sm:w-56">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--e-suave)]" aria-hidden />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar na galeria" className="w-full h-9 rounded-[10px] border border-[var(--e-borda)] bg-[var(--e-cartao)] pl-9 pr-3 text-sm" />
          </label>
        </div>
      </div>

      {lista === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[4/5] rounded-[12px] e-esqueleto" />)}</div>
      ) : lista.length === 0 ? (
        <Cartao><Vazio icone={<Images className="size-5" />} titulo={busca || tipo !== 'todos' ? 'Nada encontrado' : 'Sua galeria está vazia'} texto={busca || tipo !== 'todos' ? 'Tente outro filtro ou outra palavra.' : 'Tudo o que você gerar aparece aqui, pronto para baixar.'} acao={<LinkBotao href="/estudio/foto" variante="principal" icone={<Camera className="size-4" />}>Gerar fotos</LinkBotao>} /></Cartao>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{lista.map((c) => <Miniatura key={c.id} criacao={c} aoClicar={() => setAberta(c)} />)}</div>
      )}

      {aberta && <Detalhe criacao={aberta} aoFechar={() => setAberta(null)} aoApagar={() => apagar(aberta)} />}
    </>
  );
}

function Detalhe({ criacao: c, aoFechar, aoApagar }: { criacao: Criacao; aoFechar: () => void; aoApagar: () => void }) {
  const kit = useKitMarca();
  const arte = useRef<ArteRef>(null);
  const [indice, setIndice] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const url = c.arquivos[indice];
  const data = useMemo(() => new Date(c.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }), [c.criadoEm]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aoFechar]);

  async function baixarAtual() {
    if (c.tipo === 'post') {
      const png = arte.current?.png();
      if (png) baixar(png, nomeArquivo(c, 0));
      return;
    }
    if (!url) return;
    if (ehVideo(url)) return baixar(url, nomeArquivo(c, indice, url.includes('mp4') ? 'mp4' : 'webm'));
    const { largura, altura } = FORMATOS[c.formato ?? '1:1'];
    baixar(await paraPng(url, largura, altura), nomeArquivo(c, indice));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={c.titulo} onClick={aoFechar}>
      <div className="estudio w-full sm:max-w-4xl max-h-[92vh] overflow-auto rounded-t-[18px] sm:rounded-[18px] bg-[var(--e-cartao)] border border-[var(--e-borda)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-[var(--e-borda)]">
          <div className="flex items-center gap-2 min-w-0"><Selo tom="acento">{ROTULO_TIPO[c.tipo]}</Selo><span className="truncate text-sm font-medium">{c.titulo}</span></div>
          <Botao variante="fantasma" className="px-2" onClick={aoFechar} aria-label="Fechar"><X className="size-4" /></Botao>
        </div>
        <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="p-5 bg-[var(--e-cartao-2)]">
            <div className="max-w-md mx-auto">
              {c.tipo === 'post' && c.arte && kit ? (
                <Arte ref={arte} modelo={c.modelo!} formato={c.formato!} marca={kit} textos={c.arte.textos} fundo={c.arte.fundo} fotosReais={c.arte.fotosReais} />
              ) : url && ehVideo(url) ? (
                <video src={url} controls playsInline loop className="w-full rounded-[12px]" />
              ) : url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt={c.titulo} className="w-full rounded-[12px]" />
              ) : (
                <p className="text-sm text-[var(--e-suave)] text-center py-16">{c.status === 'gerando' ? 'Ainda gerando…' : c.erro ?? 'Sem arquivo.'}</p>
              )}
              {c.arquivos.length > 1 && (
                <div className="flex gap-2 mt-3 justify-center">
                  {c.arquivos.map((u, i) => (
                    <button key={i} onClick={() => setIndice(i)} aria-label={`Variação ${i + 1}`} className={cx('size-12 rounded-[8px] overflow-hidden border-2', i === indice ? 'border-[var(--e-acento)]' : 'border-transparent')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" className="size-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="p-5 space-y-4">
            <dl className="text-sm grid grid-cols-2 gap-y-2">
              <dt className="text-[var(--e-suave)]">Criado</dt><dd>{data}</dd>
              {c.formato && <><dt className="text-[var(--e-suave)]">Formato</dt><dd className="e-mono">{c.formato}</dd></>}
              <dt className="text-[var(--e-suave)]">Créditos</dt><dd className="e-mono">{c.creditos}</dd>
            </dl>
            {c.legenda && (
              <div>
                <div className="text-sm font-medium mb-1">Legenda</div>
                <p className="text-sm text-[var(--e-suave)] whitespace-pre-line max-h-40 overflow-auto">{legendaCompleta({ legenda: c.legenda, hashtags: c.hashtags ?? [] })}</p>
                <Botao variante="fantasma" className="h-8 px-2 mt-1" onClick={async () => { await navigator.clipboard.writeText(legendaCompleta({ legenda: c.legenda!, hashtags: c.hashtags ?? [] })); setCopiado(true); }} icone={<Copy className="size-4" />}>{copiado ? 'Copiada' : 'Copiar'}</Botao>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              {c.status === 'pronta' && <Botao onClick={baixarAtual} icone={<Download className="size-4" />}>Baixar</Botao>}
              {c.tipo === 'post' ? (
                <LinkBotao href={`/estudio/post?origem=${c.id}`} icone={<Sparkles className="size-4" />}>Editar texto</LinkBotao>
              ) : c.tipo === 'foto' ? (
                <>
                  <LinkBotao href={`/estudio/post?origem=${c.id}`} icone={<Sparkles className="size-4" />}>Usar num post</LinkBotao>
                  <LinkBotao href={`/estudio/video?origem=${c.id}`} icone={<Clapperboard className="size-4" />}>Fazer vídeo</LinkBotao>
                  <LinkBotao href={`/estudio/foto?origem=${c.id}`} icone={<Camera className="size-4" />}>Gerar mais</LinkBotao>
                </>
              ) : null}
              <Botao variante="perigo" onClick={aoApagar} icone={<Trash2 className="size-4" />}>Apagar</Botao>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
