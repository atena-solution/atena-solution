'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, Megaphone, MessageSquareQuote, Save, SplitSquareHorizontal, Sparkles, Star, Wand2 } from 'lucide-react';
import { CUSTO_CREDITOS } from '@/lib/estudio/creditos';
import { FORMATOS } from '@/lib/estudio/prompts';
import { legendaCompleta } from '@/lib/estudio/legenda';
import { nomeArquivo } from '@/lib/estudio/galeria';
import type { Criacao, Formato, ModeloPost } from '@/lib/estudio/tipos';
import { Arte, type ArteRef } from '../_componentes/Arte';
import { avisarSaldo, baixar, chamar, ErroApi } from '../_componentes/cliente';
import { EnviarFotos } from '../_componentes/EnviarFotos';
import { useKitMarca } from '../_componentes/Miniatura';
import { Aviso, Botao, Campo, Cartao, Custo, Opcoes, Titulo } from '../_componentes/ui';

const MODELOS: { valor: ModeloPost; titulo: string; descricao: string; icone: React.ReactNode }[] = [
  { valor: 'promocao', titulo: 'Promoção', descricao: 'Oferta, desconto, combo', icone: <Megaphone className="size-4" /> },
  { valor: 'novidade', titulo: 'Novidade', descricao: 'Lançamento, chegou, dica', icone: <Star className="size-4" /> },
  { valor: 'depoimento', titulo: 'Depoimento', descricao: 'Fala de cliente', icone: <MessageSquareQuote className="size-4" /> },
  { valor: 'antes-depois', titulo: 'Antes e depois', descricao: 'Só com fotos reais', icone: <SplitSquareHorizontal className="size-4" /> },
];

export default function PostPage() {
  const kit = useKitMarca();
  const [modelo, setModelo] = useState<ModeloPost>('promocao');
  const [formato, setFormato] = useState<Formato>('4:5');
  const [tema, setTema] = useState('');
  const [oferta, setOferta] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [usarFoto, setUsarFoto] = useState(true);
  const [pautaId, setPautaId] = useState<string | undefined>();
  const [saldo, setSaldo] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [post, setPost] = useState<Criacao | null>(null);
  const [textos, setTextos] = useState({ titulo: '', subtitulo: '', chamada: '' });
  const [legenda, setLegenda] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);
  const [salvo, setSalvo] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const arte = useRef<ArteRef>(null);

  useEffect(() => {
    chamar<{ saldo: number }>('/api/estudio/creditos').then((r) => setSaldo(r.saldo)).catch(() => {});
    const q = new URLSearchParams(location.search);
    if (q.get('tema')) setTema(q.get('tema')!);
    if (q.get('modelo')) setModelo(q.get('modelo') as ModeloPost);
    if (q.get('pauta')) setPautaId(q.get('pauta')!);
    const origem = q.get('origem');
    if (origem) chamar<{ criacao: Criacao }>(`/api/estudio/galeria/${origem}`).then(({ criacao }) => {
      if (criacao.tipo === 'post') return abrir(criacao);
      setFotos(criacao.arquivos.filter((u) => !u.startsWith('data:video')).slice(0, 1));
      setTema(criacao.titulo);
    }).catch(() => {});
  }, []);

  function abrir(c: Criacao) {
    setPost(c);
    setModelo(c.modelo ?? 'promocao');
    setFormato(c.formato ?? '4:5');
    setTema(c.titulo);
    setTextos({ titulo: c.arte?.textos.titulo ?? '', subtitulo: c.arte?.textos.subtitulo ?? '', chamada: c.arte?.textos.chamada ?? '' });
    setLegenda(c.legenda ? legendaCompleta({ legenda: c.legenda, hashtags: c.hashtags ?? [] }) : '');
    setSalvo(true);
  }

  const antesDepois = modelo === 'antes-depois';
  const maxFotos = antesDepois ? 2 : 1;
  const podeGerar = !!tema.trim() && (!antesDepois || fotos.length === 2) && (saldo == null || saldo >= CUSTO_CREDITOS.post);

  async function gerar() {
    setErro('');
    setGerando(true);
    try {
      const r = await chamar<{ criacao: Criacao; saldo: number }>('/api/estudio/post', { corpo: { modelo, formato, tema, oferta, fotosReais: fotos.slice(0, maxFotos), usarFotoComoFundo: usarFoto, pautaId } });
      setSaldo(r.saldo);
      avisarSaldo(r.saldo);
      if (r.criacao.status === 'falhou') setErro(r.criacao.erro ?? 'Não deu certo. Os créditos foram devolvidos.');
      else abrir(r.criacao);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Sem conexão. Tente de novo.');
    } finally {
      setGerando(false);
    }
  }

  async function salvar() {
    if (!post) return;
    const r = await chamar<{ criacao: Criacao }>(`/api/estudio/post/${post.id}`, { metodo: 'PATCH', corpo: { textos, legenda } });
    setPost(r.criacao);
    setSalvo(true);
  }

  function baixarPng() {
    const png = arte.current?.png();
    if (png && post) baixar(png, nomeArquivo(post, 0));
  }

  async function copiar() {
    await navigator.clipboard.writeText(legenda);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  const editar = (campo: keyof typeof textos) => (v: string) => { setTextos((t) => ({ ...t, [campo]: v })); setSalvo(false); };

  return (
    <>
      <Titulo titulo="Post com a sua marca" descricao="Diga o tema ou a oferta. A Atena cria o fundo, escreve o título e a legenda — e o texto é colocado pelo sistema, sempre legível e sem erro de letra." />
      {!post || gerando ? (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <div className="space-y-6">
            <Cartao className="p-5 space-y-6">
              <Opcoes rotulo="Tipo de post" valor={modelo} aoMudar={(m) => { setModelo(m); if (m === 'antes-depois') setUsarFoto(true); }} colunas="grid-cols-2 sm:grid-cols-4" opcoes={MODELOS} />
              <Campo rotulo="Tema do post" valor={tema} aoMudar={setTema} max={200} placeholder={antesDepois ? 'Ex.: Limpeza de pele profunda' : 'Ex.: Black Friday — corte + barba'} />
              {modelo === 'promocao' && <Campo rotulo="Oferta (opcional)" dica="Escreva exatamente o que vale. A IA não inventa preço nem prazo." valor={oferta} aoMudar={setOferta} max={120} placeholder="Ex.: 20% off até sexta" />}
            </Cartao>
            <Cartao className="p-5 space-y-5">
              <EnviarFotos
                key={maxFotos}
                fotos={fotos.slice(0, maxFotos)}
                aoMudar={setFotos}
                max={maxFotos}
                rotulo={antesDepois ? 'Fotos reais: antes e depois' : 'Foto real (opcional)'}
                dica={antesDepois ? 'Obrigatório: 2 fotos reais do mesmo cliente. Nada é inventado.' : 'Use uma foto do seu produto ou do seu espaço. Sem foto, a Atena cria um fundo com a sua marca.'}
                nomes={antesDepois ? ['Antes', 'Depois'] : undefined}
              />
              {!antesDepois && fotos.length > 0 && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={usarFoto} onChange={(e) => setUsarFoto(e.target.checked)} className="size-4 accent-[var(--e-acento)]" />
                  Usar a foto como está (só colocar o texto por cima)
                </label>
              )}
              <Opcoes rotulo="Formato" valor={formato} aoMudar={setFormato} colunas="grid-cols-2 sm:grid-cols-4" opcoes={(Object.keys(FORMATOS) as Formato[]).map((v) => ({ valor: v, titulo: v, descricao: FORMATOS[v].rotulo }))} />
            </Cartao>
          </div>
          <div className="lg:sticky lg:top-20 space-y-4">
            <Cartao className="p-5 space-y-4">
              <p className="text-sm text-[var(--e-suave)]">Você recebe: arte pronta, título, legenda e hashtags. Pode editar o texto depois sem pagar de novo.</p>
              <Custo creditos={CUSTO_CREDITOS.post} saldo={saldo} />
              <Botao className="w-full h-11" onClick={gerar} carregando={gerando} disabled={!podeGerar} icone={<Wand2 className="size-4" />}>{gerando ? 'Criando o post…' : 'Criar post'}</Botao>
              {antesDepois && fotos.length < 2 && <p className="text-xs text-[var(--e-suave)] text-center">Envie as 2 fotos reais para continuar.</p>}
            </Cartao>
            {gerando && <div className={`rounded-[12px] e-esqueleto ${formato === '9:16' ? 'aspect-[9/16]' : formato === '1:1' ? 'aspect-square' : formato === '3:4' ? 'aspect-[3/4]' : 'aspect-[4/5]'}`} />}
            {erro && <Aviso>{erro}</Aviso>}
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6 items-start">
          <div className="max-w-[560px] w-full mx-auto">
            {kit && post.arte && <Arte ref={arte} modelo={post.modelo!} formato={post.formato!} marca={kit} textos={textos} fundo={post.arte.fundo} fotosReais={post.arte.fotosReais} aoAvisar={setAvisos} />}
            {avisos.map((a) => <p key={a} className="text-xs text-[#B07818] mt-2">{a}</p>)}
          </div>
          <div className="space-y-4">
            <Cartao className="p-5 space-y-4">
              <h2 className="font-medium flex items-center gap-2"><Sparkles className="size-4 text-[var(--e-acento)]" aria-hidden />Texto da arte</h2>
              <Campo rotulo="Título" valor={textos.titulo} aoMudar={editar('titulo')} max={60} />
              <Campo rotulo="Subtítulo" valor={textos.subtitulo} aoMudar={editar('subtitulo')} max={90} />
              <Campo rotulo="Botão / chamada" valor={textos.chamada} aoMudar={editar('chamada')} max={24} />
            </Cartao>
            <Cartao className="p-5 space-y-3">
              <Campo rotulo="Legenda" multilinha valor={legenda} aoMudar={(v) => { setLegenda(v); setSalvo(false); }} max={2400} />
              <Botao variante="secundario" onClick={copiar} icone={copiado ? <Check className="size-4" /> : <Copy className="size-4" />}>{copiado ? 'Copiada' : 'Copiar legenda'}</Botao>
            </Cartao>
            <div className="flex flex-wrap gap-2">
              <Botao onClick={baixarPng} icone={<Download className="size-4" />}>Baixar arte</Botao>
              <Botao variante="secundario" onClick={salvar} disabled={salvo} icone={<Save className="size-4" />}>{salvo ? 'Salvo na galeria' : 'Salvar alterações'}</Botao>
              <Botao variante="fantasma" onClick={() => { setPost(null); setFotos([]); }}>Novo post</Botao>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
