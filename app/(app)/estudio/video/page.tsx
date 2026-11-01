'use client';
import { useEffect, useRef, useState } from 'react';
import { Circle, Clapperboard, Download, Film, Pause, Play, Save, Wand2 } from 'lucide-react';
import { CUSTO_CREDITOS } from '@/lib/estudio/creditos';
import { ROTULO_MOVIMENTO, type PedidoVideo } from '@/lib/estudio/prompts';
import { criarRoteiro, escalaKenBurns, quadroEm, type Transicao } from '@/lib/estudio/slideshow';
import type { Criacao } from '@/lib/estudio/tipos';
import { avisarSaldo, baixar, carregarImagem, chamar, ErroApi } from '../_componentes/cliente';
import { EnviarFotos } from '../_componentes/EnviarFotos';
import { Aviso, Botao, Campo, Cartao, Custo, Opcoes, Titulo, cx } from '../_componentes/ui';

type Modo = 'ia' | 'slideshow';

export default function VideoPage() {
  const [modo, setModo] = useState<Modo>('slideshow');
  const [fotosOrigem, setFotosOrigem] = useState<string[]>([]);
  useEffect(() => {
    const origem = new URLSearchParams(location.search).get('origem');
    if (origem) chamar<{ criacao: Criacao }>(`/api/estudio/galeria/${origem}`).then(({ criacao }) => setFotosOrigem(criacao.arquivos.filter((u) => !u.startsWith('data:video')))).catch(() => {});
  }, []);

  return (
    <>
      <Titulo titulo="Vídeo curto" descricao="Vídeo vertical para Reels, TikTok e Status. Escolha: slideshow animado (grátis, feito no seu navegador) ou vídeo com IA a partir de uma foto." />
      <div role="tablist" aria-label="Tipo de vídeo" className="inline-flex p-1 rounded-[12px] border border-[var(--e-borda)] bg-[var(--e-cartao)] mb-6">
        {([['slideshow', 'Slideshow grátis', Film], ['ia', 'Vídeo com IA', Wand2]] as const).map(([v, rotulo, Icone]) => (
          <button key={v} role="tab" aria-selected={modo === v} onClick={() => setModo(v)} className={cx('flex items-center gap-2 h-9 px-4 rounded-[9px] text-sm transition', modo === v ? 'bg-[var(--e-acento-fraco)] font-medium' : 'text-[var(--e-suave)] hover:text-[var(--e-texto)]')}>
            <Icone className="size-4" aria-hidden />{rotulo}
          </button>
        ))}
      </div>
      {modo === 'slideshow' ? <Slideshow iniciais={fotosOrigem} /> : <VideoIA inicial={fotosOrigem[0]} />}
    </>
  );
}

// ---------- Vídeo com IA ----------

function VideoIA({ inicial }: { inicial?: string }) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [produto, setProduto] = useState('');
  const [formato, setFormato] = useState<'9:16' | '1:1'>('9:16');
  const [movimento, setMovimento] = useState<PedidoVideo['movimento']>('giro-suave');
  const [duracao, setDuracao] = useState(6);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [criacao, setCriacao] = useState<Criacao | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { if (inicial) setFotos([inicial]); }, [inicial]);
  useEffect(() => { chamar<{ saldo: number }>('/api/estudio/creditos').then((r) => setSaldo(r.saldo)).catch(() => {}); }, []);

  // Consulta o andamento a cada 5 s enquanto estiver gerando.
  useEffect(() => {
    if (criacao?.status !== 'gerando') return;
    const t = setInterval(async () => {
      try {
        const r = await chamar<{ criacao: Criacao }>(`/api/estudio/video/${criacao.id}`);
        setCriacao(r.criacao);
        if (r.criacao.status === 'falhou') {
          setErro(r.criacao.erro ?? 'O vídeo falhou. Os créditos foram devolvidos.');
          chamar<{ saldo: number }>('/api/estudio/creditos').then((x) => { setSaldo(x.saldo); avisarSaldo(x.saldo); }).catch(() => {});
        }
      } catch { /* tenta de novo */ }
    }, 5000);
    return () => clearInterval(t);
  }, [criacao?.id, criacao?.status]);

  async function gerar() {
    setErro('');
    setEnviando(true);
    try {
      const r = await chamar<{ criacao: Criacao; saldo: number }>('/api/estudio/video', { corpo: { foto: fotos[0], produto, formato, movimento, duracaoSeg: duracao } });
      setCriacao(r.criacao);
      setSaldo(r.saldo);
      avisarSaldo(r.saldo);
      if (r.criacao.status === 'falhou') setErro(r.criacao.erro ?? 'Não deu para iniciar.');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Sem conexão. Tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  const gerando = criacao?.status === 'gerando';
  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="space-y-6">
        <Cartao className="p-5 space-y-6">
          <EnviarFotos fotos={fotos} aoMudar={setFotos} max={1} rotulo="Foto do produto" dica="Uma foto nítida. O produto fica idêntico; só a câmera e a luz se mexem." />
          <Campo rotulo="O que é?" valor={produto} aoMudar={setProduto} max={120} placeholder="Ex.: perfume em frasco de vidro" />
        </Cartao>
        <Cartao className="p-5 space-y-6">
          <Opcoes rotulo="Movimento" valor={movimento} aoMudar={setMovimento} colunas="grid-cols-2 sm:grid-cols-4" opcoes={(Object.keys(ROTULO_MOVIMENTO) as PedidoVideo['movimento'][]).map((v) => ({ valor: v, titulo: ROTULO_MOVIMENTO[v] }))} />
          <Opcoes rotulo="Formato" valor={formato} aoMudar={setFormato} colunas="grid-cols-2" opcoes={[{ valor: '9:16', titulo: 'Vertical 9:16', descricao: 'Reels, TikTok, Status' }, { valor: '1:1', titulo: 'Quadrado 1:1', descricao: 'Feed' }]} />
          <div>
            <div className="flex items-center justify-between text-sm mb-2"><span className="font-medium">Duração</span><span className="e-mono">{duracao} s</span></div>
            <input type="range" min={5} max={8} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className="w-full accent-[var(--e-acento)]" aria-label="Duração em segundos" />
          </div>
        </Cartao>
      </div>
      <div className="lg:sticky lg:top-20 space-y-4">
        <Cartao className="p-5 space-y-4">
          <Custo creditos={CUSTO_CREDITOS.video} saldo={saldo} />
          <Botao className="w-full h-11" onClick={gerar} carregando={enviando || gerando} disabled={!fotos.length || (saldo != null && saldo < CUSTO_CREDITOS.video)} icone={<Wand2 className="size-4" />}>
            {gerando ? 'Criando o vídeo…' : 'Gerar vídeo'}
          </Botao>
          <p className="text-xs text-[var(--e-suave)]">Leva de 1 a 3 minutos. Pode sair da tela: o vídeo aparece na galeria. Se falhar, os créditos voltam.</p>
        </Cartao>
        {erro && <Aviso>{erro}</Aviso>}
        {criacao && (
          <div className={cx('rounded-[12px] overflow-hidden border border-[var(--e-borda)] bg-black', criacao.formato === '1:1' ? 'aspect-square' : 'aspect-[9/16] max-h-[70vh] mx-auto')}>
            {criacao.status === 'pronta' && criacao.arquivos[0] ? (
              criacao.arquivos[0].startsWith('data:image') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={criacao.arquivos[0]} alt="Prévia do vídeo (simulado)" className="size-full object-cover" />
              ) : (
                <video src={criacao.arquivos[0]} controls playsInline loop className="size-full object-cover" />
              )
            ) : (
              <div className="size-full e-esqueleto grid place-items-center text-sm text-[var(--e-suave)]">{gerando ? 'Gerando…' : ''}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Slideshow (navegador, zero crédito) ----------

const TAMANHO = { '9:16': [720, 1280], '1:1': [1080, 1080], '4:5': [1080, 1350] } as const;

function Slideshow({ iniciais }: { iniciais: string[] }) {
  const [fotos, setFotos] = useState<string[]>([]);
  const [duracao, setDuracao] = useState(8);
  const [transicao, setTransicao] = useState<Transicao>('cruzar');
  const [formato, setFormato] = useState<'9:16' | '1:1' | '4:5'>('9:16');
  const [titulo, setTitulo] = useState('');
  const [tocando, setTocando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [video, setVideo] = useState<{ url: string; blob: Blob } | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const imagens = useRef<HTMLImageElement[]>([]);
  const raf = useRef(0);

  useEffect(() => { if (iniciais.length) setFotos(iniciais.slice(0, 10)); }, [iniciais]);

  useEffect(() => {
    let vivo = true;
    Promise.all(fotos.map((f) => carregarImagem(f))).then((imgs) => { if (vivo) { imagens.current = imgs; desenhar(0); } }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos, formato]);

  const roteiro = fotos.length ? criarRoteiro(fotos.length, duracao, transicao) : null;

  function desenhar(t: number) {
    const cv = canvas.current;
    if (!cv || !roteiro || !imagens.current.length) return;
    const [W, H] = TAMANHO[formato];
    if (cv.width !== W) { cv.width = W; cv.height = H; }
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#0E1116';
    ctx.fillRect(0, 0, W, H);
    const q = quadroEm(roteiro, t);
    const pintar = (img: HTMLImageElement, progresso: number, alpha: number, deslocX = 0) => {
      const escala = transicao === 'zoom' ? escalaKenBurns(progresso) * 1.04 : escalaKenBurns(progresso * 0.5);
      const r = Math.max(W / img.naturalWidth, H / img.naturalHeight) * escala;
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (W - w) / 2 + deslocX, (H - h) / 2, w, h);
      ctx.globalAlpha = 1;
    };
    const atual = imagens.current[q.indice];
    const prox = q.proxima != null ? imagens.current[q.proxima] : null;
    if (transicao === 'deslizar' && prox && q.mistura > 0) {
      pintar(atual, q.progresso, 1, -W * q.mistura);
      pintar(prox, 0, 1, W * (1 - q.mistura));
    } else {
      pintar(atual, q.progresso, 1);
      if (prox && q.mistura > 0) pintar(prox, 0, q.mistura);
    }
  }

  function tocar(aoTerminar?: () => void) {
    if (!roteiro) return;
    cancelAnimationFrame(raf.current);
    const inicio = performance.now();
    setTocando(true);
    const passo = () => {
      const t = (performance.now() - inicio) / 1000;
      desenhar(t);
      if (t < roteiro.duracaoTotal) raf.current = requestAnimationFrame(passo);
      else { setTocando(false); aoTerminar?.(); }
    };
    raf.current = requestAnimationFrame(passo);
  }

  function parar() {
    cancelAnimationFrame(raf.current);
    setTocando(false);
  }

  async function gravar() {
    const cv = canvas.current;
    if (!cv || !roteiro) return;
    if (typeof MediaRecorder === 'undefined' || !cv.captureStream) return setErro('Seu navegador não grava vídeo. Use o Chrome ou o Safari atualizado.');
    setErro('');
    setSalvo(false);
    const tipo = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? 'video/webm';
    const stream = cv.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 2_500_000 });
    const partes: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(partes, { type: tipo.split(';')[0] });
      setVideo({ url: URL.createObjectURL(blob), blob });
      setGravando(false);
    };
    setGravando(true);
    rec.start(250);
    tocar(() => setTimeout(() => rec.stop(), 120));
  }

  async function salvar() {
    if (!video) return;
    const dataUrl: string = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(video.blob); });
    try {
      await chamar('/api/estudio/slideshow', { corpo: { arquivo: dataUrl, titulo: titulo || 'Slideshow', formato } });
      setSalvo(true);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu para salvar.');
    }
  }

  const ext = video?.blob.type.includes('mp4') ? 'mp4' : 'webm';
  const proporcao = formato === '9:16' ? 'aspect-[9/16]' : formato === '1:1' ? 'aspect-square' : 'aspect-[4/5]';

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="space-y-6">
        <Cartao className="p-5 space-y-6">
          <EnviarFotos fotos={fotos} aoMudar={(f) => { setFotos(f); setVideo(null); }} max={10} rotulo="Fotos do slideshow" dica="De 1 a 10 fotos, na ordem em que vão aparecer." />
          <Campo rotulo="Nome (para a galeria)" valor={titulo} aoMudar={setTitulo} max={80} placeholder="Ex.: Coleção de verão" />
        </Cartao>
        <Cartao className="p-5 space-y-6">
          <Opcoes rotulo="Transição" valor={transicao} aoMudar={setTransicao} colunas="grid-cols-3" opcoes={[{ valor: 'cruzar', titulo: 'Suave' }, { valor: 'deslizar', titulo: 'Deslizar' }, { valor: 'zoom', titulo: 'Zoom' }]} />
          <Opcoes rotulo="Formato" valor={formato} aoMudar={setFormato} colunas="grid-cols-3" opcoes={[{ valor: '9:16', titulo: '9:16' }, { valor: '4:5', titulo: '4:5' }, { valor: '1:1', titulo: '1:1' }]} />
          <div>
            <div className="flex items-center justify-between text-sm mb-2"><span className="font-medium">Duração</span><span className="e-mono">{duracao} s</span></div>
            <input type="range" min={3} max={30} value={duracao} onChange={(e) => setDuracao(Number(e.target.value))} className="w-full accent-[var(--e-acento)]" aria-label="Duração em segundos" />
          </div>
        </Cartao>
      </div>
      <div className="lg:sticky lg:top-20 space-y-4">
        <div className={cx('rounded-[12px] overflow-hidden border border-[var(--e-borda)] bg-[#0E1116] mx-auto', proporcao, formato === '9:16' && 'max-h-[62vh]')}>
          {fotos.length ? <canvas ref={canvas} className="size-full" aria-label="Prévia do slideshow" /> : (
            <div className="size-full grid place-items-center text-sm text-[#9AA1AE] p-6 text-center"><span><Clapperboard className="size-6 mx-auto mb-2" aria-hidden />Adicione fotos para ver a prévia</span></div>
          )}
        </div>
        <Cartao className="p-5 space-y-3">
          <Custo creditos={0} />
          <div className="flex gap-2">
            <Botao variante="secundario" className="flex-1" disabled={!fotos.length || gravando} onClick={() => (tocando ? parar() : tocar())} icone={tocando ? <Pause className="size-4" /> : <Play className="size-4" />}>{tocando ? 'Pausar' : 'Ver prévia'}</Botao>
            <Botao className="flex-1" disabled={!fotos.length} carregando={gravando} onClick={gravar} icone={<Circle className="size-4" />}>{gravando ? 'Gravando…' : 'Gravar vídeo'}</Botao>
          </div>
          {video && (
            <div className="flex gap-2 pt-1">
              <Botao variante="secundario" className="flex-1" onClick={() => baixar(video.url, `atena-slideshow-${Date.now()}.${ext}`)} icone={<Download className="size-4" />}>Baixar</Botao>
              <Botao variante="secundario" className="flex-1" disabled={salvo} onClick={salvar} icone={<Save className="size-4" />}>{salvo ? 'Na galeria' : 'Salvar'}</Botao>
            </div>
          )}
        </Cartao>
        {erro && <Aviso>{erro}</Aviso>}
      </div>
    </div>
  );
}
