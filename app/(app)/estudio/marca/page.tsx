'use client';
import { useEffect, useState } from 'react';
import { Check, ImagePlus, Save, X } from 'lucide-react';
import { FONTES_DISPONIVEIS, KIT_PADRAO, normalizarHex } from '@/lib/estudio/marca';
import { contraste } from '@/lib/estudio/arte';
import type { KitMarca } from '@/lib/estudio/tipos';
import { Arte } from '../_componentes/Arte';
import { chamar, ErroApi, prepararFoto } from '../_componentes/cliente';
import { limparCacheKit } from '../_componentes/Miniatura';
import { Aviso, Botao, Campo, Cartao, Rotulo, Titulo } from '../_componentes/ui';

const FUNDO_EXEMPLO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#EDE7DD"/><stop offset="1" stop-color="#B9AE9C"/></linearGradient></defs><rect width="1080" height="1350" fill="url(#g)"/><circle cx="540" cy="560" r="260" fill="#fff" opacity=".55"/></svg>')}`;

export default function MarcaPage() {
  const [kit, setKit] = useState<KitMarca | null>(null);
  const [evitar, setEvitar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');

  useEffect(() => {
    chamar<{ kit: KitMarca }>('/api/estudio/marca').then((r) => { setKit(r.kit); setEvitar(r.kit.evitar.join(', ')); }).catch(() => setKit(KIT_PADRAO));
  }, []);

  if (!kit) return <div className="h-96 rounded-[14px] e-esqueleto" />;
  const mudar = (p: Partial<KitMarca>) => { setKit({ ...kit, ...p }); setOk(false); };

  async function salvar() {
    setSalvando(true);
    setErro('');
    setErros({});
    try {
      const r = await chamar<{ kit: KitMarca }>('/api/estudio/marca', { metodo: 'PUT', corpo: { ...kit, evitar: evitar.split(',').map((s) => s.trim()).filter(Boolean) } });
      setKit(r.kit);
      limparCacheKit();
      setOk(true);
    } catch (e) {
      if (e instanceof ErroApi && e.dados.campos) setErros(e.dados.campos as Record<string, string>);
      setErro(e instanceof Error ? e.message : 'Não deu para salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function subirLogo(f: File | undefined) {
    if (!f) return;
    try { mudar({ logoUrl: await prepararFoto(f, 512, 0.92) }); } catch (e) { setErro(e instanceof Error ? e.message : 'Logo inválido.'); }
  }

  const corValida = (c: string) => normalizarHex(c) ?? '#000000';
  const contrasteCta = contraste(corValida(kit.cores.primaria), '#FFFFFF');

  return (
    <>
      <Titulo titulo="Kit da marca" descricao="Logo, cores, fontes e jeito de falar. Tudo o que o Estúdio cria segue este kit." acao={<Botao onClick={salvar} carregando={salvando} icone={ok ? <Check className="size-4" /> : <Save className="size-4" />}>{ok ? 'Salvo' : 'Salvar kit'}</Botao>} />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="space-y-6">
          <Cartao className="p-5 space-y-6">
            <div>
              <Rotulo dica="PNG com fundo transparente fica melhor.">Logo</Rotulo>
              <div className="flex items-center gap-4">
                <div className="size-20 rounded-[14px] border border-[var(--e-borda)] bg-[var(--e-cartao-2)] grid place-items-center overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {kit.logoUrl ? <img src={kit.logoUrl} alt="Logo" className="size-full object-contain p-2" /> : <ImagePlus className="size-6 text-[var(--e-suave)]" aria-hidden />}
                </div>
                <label className="inline-flex items-center gap-2 h-10 px-4 rounded-[10px] border border-[var(--e-borda)] text-sm cursor-pointer hover:bg-[var(--e-cartao-2)]">
                  <ImagePlus className="size-4" aria-hidden />{kit.logoUrl ? 'Trocar logo' : 'Enviar logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={(e) => void subirLogo(e.target.files?.[0])} />
                </label>
                {kit.logoUrl && <Botao variante="fantasma" className="px-2" onClick={() => mudar({ logoUrl: '' })} aria-label="Remover logo"><X className="size-4" /></Botao>}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {(['primaria', 'secundaria'] as const).map((k) => (
                <div key={k}>
                  <Rotulo>{k === 'primaria' ? 'Cor principal' : 'Cor de apoio'}</Rotulo>
                  <div className="flex gap-2">
                    <input type="color" value={corValida(kit.cores[k])} onChange={(e) => mudar({ cores: { ...kit.cores, [k]: e.target.value.toUpperCase() } })} className="h-10 w-12 rounded-[10px] border border-[var(--e-borda)] bg-transparent cursor-pointer" aria-label={k === 'primaria' ? 'Escolher cor principal' : 'Escolher cor de apoio'} />
                    <input value={kit.cores[k]} onChange={(e) => mudar({ cores: { ...kit.cores, [k]: e.target.value } })} maxLength={7} className="flex-1 h-10 rounded-[10px] border border-[var(--e-borda)] bg-[var(--e-cartao)] px-3 text-sm e-mono uppercase" aria-label="Código da cor" />
                  </div>
                  {erros[k] && <p className="text-xs text-[var(--e-erro)] mt-1">{erros[k]}</p>}
                </div>
              ))}
            </div>
            {contrasteCta < 3 && <Aviso tom="info">A cor principal é clara: o texto dos botões da arte vai sair escuro para ficar legível.</Aviso>}
            <div className="grid sm:grid-cols-2 gap-4">
              {(['titulo', 'texto'] as const).map((k) => (
                <label key={k} className="block">
                  <span className="block text-sm font-medium mb-1.5">{k === 'titulo' ? 'Fonte dos títulos' : 'Fonte do texto'}</span>
                  <select value={kit.fontes[k]} onChange={(e) => mudar({ fontes: { ...kit.fontes, [k]: e.target.value } })} className="w-full h-10 rounded-[10px] border border-[var(--e-borda)] bg-[var(--e-cartao)] px-3 text-sm">
                    {FONTES_DISPONIVEIS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </label>
              ))}
            </div>
          </Cartao>
          <Cartao className="p-5 space-y-5">
            <Campo rotulo="Tom de voz" dica="Como a sua marca fala. Ex.: “próximo e divertido”, “sério e técnico”." valor={kit.tom} aoMudar={(v) => mudar({ tom: v })} max={120} erro={erros.tom} />
            <Campo rotulo="Público" dica="Para quem você vende. Ex.: “homens de 20 a 40 anos do bairro”." valor={kit.publico} aoMudar={(v) => mudar({ publico: v })} max={200} />
            <Campo rotulo="Palavras para evitar" dica="Separe por vírgula. A IA nunca usa essas palavras (ex.: cura, garantido, milagre)." valor={evitar} aoMudar={(v) => { setEvitar(v); setOk(false); }} max={400} />
          </Cartao>
          {erro && <Aviso>{erro}</Aviso>}
        </div>
        <div className="lg:sticky lg:top-20">
          <Rotulo dica="Prévia de um post com o seu kit.">Como fica</Rotulo>
          <Arte modelo="promocao" formato="4:5" marca={{ ...kit, cores: { primaria: corValida(kit.cores.primaria), secundaria: corValida(kit.cores.secundaria) } }} textos={{ titulo: 'Semana especial', subtitulo: 'Um exemplo de como o texto aparece na arte', chamada: 'Agende já' }} fundo={FUNDO_EXEMPLO} />
        </div>
      </div>
    </>
  );
}
