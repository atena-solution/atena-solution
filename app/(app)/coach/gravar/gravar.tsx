'use client';
// /coach/gravar — grava a reunião no navegador (duas trilhas ou só microfone) ou envia um arquivo pronto.
// Aceita ?contatoId=&nome=&telefone= (botão "Gravar reunião" da ficha do contato).
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { FilaDeEnvio, GravadorReuniao, lerDuracao, navegadorSuporta, type PedacoGravado } from '@/lib/coach/gravador-navegador';
import { validarArquivo } from '@/lib/coach/gravacao';
import { formatarTempo } from '@/lib/coach/transcricao';
import type { ModoGravacao, Reuniao, Trilha } from '@/lib/coach/tipos';
import { api, cabecalhosAuth } from '../_componentes/api';
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, classeEntrada } from '../_componentes/ui';

type Fase = 'escolher' | 'gravando' | 'finalizando' | 'enviando-arquivo' | 'transcrevendo' | 'analisando';

const MODOS: { id: ModoGravacao; titulo: string; texto: string }[] = [
  { id: 'duas-trilhas', titulo: 'Reunião online', texto: 'Meet, Zoom, Teams ou WhatsApp Web. Grava sua voz e o áudio da aba do cliente separados.' },
  { id: 'so-microfone', titulo: 'Presencial ou ligação', texto: 'Só o microfone. Use no viva-voz ou com o cliente na sua frente.' },
  { id: 'arquivo', titulo: 'Enviar gravação', texto: 'Já tem o áudio ou vídeo? Envie até 200 MB (mp3, m4a, wav, mp4…).' },
];

export function Gravar() {
  const q = useSearchParams();
  const router = useRouter();
  const [modo, setModo] = useState<ModoGravacao>('duas-trilhas');
  const [titulo, setTitulo] = useState('');
  const [contatoNome, setContatoNome] = useState(q.get('nome') ?? '');
  const [telefone, setTelefone] = useState(q.get('telefone') ?? '');
  const contatoId = q.get('contatoId');
  const [fase, setFase] = useState<Fase>('escolher');
  const [erro, setErro] = useState('');
  const [avisos, setAvisos] = useState<string[]>([]);
  const [segundos, setSegundos] = useState(0);
  const [niveis, setNiveis] = useState<Partial<Record<Trilha, number>>>({});
  const [fila, setFila] = useState({ pendentes: 0, falhas: 0, enviando: false });
  const [enviados, setEnviados] = useState(0);
  const [progresso, setProgresso] = useState({ feitas: 0, total: 0, pct: 0 });
  const [arquivo, setArquivo] = useState<File | null>(null);

  const reuniaoId = useRef<string | null>(null);
  const gravador = useRef<GravadorReuniao | null>(null);
  const filaRef = useRef<FilaDeEnvio | null>(null);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  // avisa antes de fechar a aba no meio da gravação (o que já foi enviado fica salvo)
  useEffect(() => {
    if (fase !== 'gravando' && fase !== 'finalizando') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [fase]);

  useEffect(() => () => { if (relogio.current) clearInterval(relogio.current); void gravador.current?.parar(); }, []);

  async function criar(extra: Record<string, unknown> = {}) {
    const r = await api<{ reuniao: Reuniao; envio: { url: string; metodo: 'PUT'; cabecalhos: Record<string, string> } | null }>('/api/coach/reunioes', {
      method: 'POST',
      body: JSON.stringify({ titulo, modo, contatoId, contatoNome: contatoNome || undefined, contatoTelefone: telefone || undefined, ...extra }),
    });
    reuniaoId.current = r.reuniao.id;
    return r;
  }

  async function enviarPedaco(p: PedacoGravado) {
    const f = new FormData();
    f.set('audio', p.blob, `${p.trilha}-${p.indice}.webm`);
    f.set('trilha', p.trilha);
    f.set('indice', String(p.indice));
    f.set('inicioSeg', p.inicioSeg.toFixed(2));
    f.set('duracaoSeg', p.duracaoSeg.toFixed(2));
    await api(`/api/coach/reunioes/${reuniaoId.current}/pedacos`, { method: 'POST', body: f });
    setEnviados((n) => n + 1);
  }

  async function comecar() {
    setErro('');
    setAvisos([]);
    const naoSuporta = navegadorSuporta(modo as Exclude<ModoGravacao, 'arquivo'>);
    if (naoSuporta) return setErro(naoSuporta);
    try {
      filaRef.current = new FilaDeEnvio(enviarPedaco, setFila);
      const g = new GravadorReuniao({
        modo: modo as Exclude<ModoGravacao, 'arquivo'>,
        aoPedaco: (p) => filaRef.current!.adicionar(p),
        aoAviso: (t) => setAvisos((a) => [...a, t]),
        aoNivel: (t, n) => setNiveis((x) => ({ ...x, [t]: n })),
      });
      const { semAudioDaAba } = await g.iniciar();
      gravador.current = g;
      await criar({ semAudioDaAba });
      setFase('gravando');
      relogio.current = setInterval(() => setSegundos(g.segundos()), 500);
    } catch (e) {
      await gravador.current?.parar();
      const msg = (e as Error).name === 'NotAllowedError' ? 'Você não liberou o microfone. Clique no cadeado ao lado do endereço e permita o microfone.' : (e as Error).message;
      setErro(msg);
      setFase('escolher');
    }
  }

  async function encerrar() {
    setFase('finalizando');
    if (relogio.current) clearInterval(relogio.current);
    await gravador.current?.parar();
    await filaRef.current?.esvaziar();
    if (filaRef.current?.falhas.length) {
      setErro(`${filaRef.current.falhas.length} pedaço(s) não subiram. Confira a internet e clique em "Tentar de novo", ou analise só o que foi salvo.`);
      return;
    }
    await analisar();
  }

  async function analisar() {
    setFase('analisando');
    setErro('');
    try {
      await api(`/api/coach/reunioes/${reuniaoId.current}/analisar`, { method: 'POST' });
      router.push(`/coach/reunioes/${reuniaoId.current}`);
    } catch (e) {
      setErro((e as Error).message);
      setFase(modo === 'arquivo' ? 'transcrevendo' : 'finalizando');
    }
  }

  async function enviarArquivo() {
    if (!arquivo) return;
    setErro('');
    const invalido = validarArquivo({ nome: arquivo.name, mime: arquivo.type, bytes: arquivo.size });
    if (invalido) return setErro(invalido);
    try {
      setFase('enviando-arquivo');
      const duracaoSeg = await lerDuracao(arquivo);
      const mime = arquivo.type || 'audio/mpeg';
      const { envio } = await criar({ arquivo: { nome: arquivo.name, mime, bytes: arquivo.size, duracaoSeg } });
      if (!envio) throw new Error('Não deu pra preparar o envio.');
      await subir(envio.url, arquivo, envio.url.startsWith('/') ? { ...envio.cabecalhos, ...(await cabecalhosAuth()) } : envio.cabecalhos, (pct) => setProgresso((p) => ({ ...p, pct })));
      await transcreverArquivo();
    } catch (e) {
      setErro((e as Error).message);
      setFase('escolher');
    }
  }

  /** Chama o servidor parte por parte (cada chamada faz um passo) e depois analisa. */
  async function transcreverArquivo() {
    setFase('transcrevendo');
    setErro('');
    try {
      for (let i = 0; i < 100; i++) {
        const r = await api<{ feitas: number; total: number; terminou: boolean }>(`/api/coach/reunioes/${reuniaoId.current}/arquivo`, { method: 'POST' });
        setProgresso((p) => ({ ...p, feitas: r.feitas, total: r.total }));
        if (r.terminou) break;
      }
      await analisar();
    } catch (e) {
      setErro((e as Error).message);
      setFase('transcrevendo');
    }
  }

  const gravando = fase === 'gravando' || fase === 'finalizando';

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina titulo="Gravar reunião" descricao="Avise o cliente que a conversa vai ser gravada pra melhorar o atendimento." />

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {avisos.map((a, i) => <Aviso key={i}>{a}</Aviso>)}

      {fase === 'escolher' && (
        <>
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Como vai gravar">
            {MODOS.map((m) => (
              <button
                key={m.id}
                role="radio"
                aria-checked={modo === m.id}
                onClick={() => setModo(m.id)}
                className={`rounded-[14px] border p-4 text-left transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-coach ${
                  modo === m.id ? 'border-coach bg-coach/10' : 'border-borda bg-superficie hover:border-coach'
                }`}
              >
                <p className="font-medium">{m.titulo}</p>
                <p className="mt-1 text-sm text-texto-2">{m.texto}</p>
              </button>
            ))}
          </div>

          <Cartao>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo rotulo="Título (opcional)"><input className={classeEntrada} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Proposta plano anual" /></Campo>
              <Campo rotulo="Cliente"><input className={classeEntrada} value={contatoNome} onChange={(e) => setContatoNome(e.target.value)} placeholder="Nome do cliente" /></Campo>
              <Campo rotulo="WhatsApp do cliente" dica="Pro follow-up."><input className={classeEntrada} value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(11) 98888-7777" /></Campo>
            </div>
          </Cartao>

          {modo === 'arquivo' ? (
            <Cartao>
              <div className="flex flex-wrap items-center gap-4">
                <input type="file" accept="audio/*,video/*" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} className="text-sm file:mr-3 file:rounded-[10px] file:border file:border-borda file:bg-superficie file:px-3 file:py-2 file:text-sm" />
                <Botao variante="principal" onClick={enviarArquivo} disabled={!arquivo}>Enviar e analisar</Botao>
              </div>
            </Cartao>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <Botao variante="principal" onClick={comecar} className="px-6 py-3 text-base">● Começar a gravar</Botao>
              {modo === 'duas-trilhas' && (
                <p className="max-w-lg text-sm text-texto-2">O navegador vai pedir o microfone e depois pra escolher a aba da reunião: escolha a aba e marque <strong>“Compartilhar áudio da guia”</strong>.</p>
              )}
            </div>
          )}
        </>
      )}

      {gravando && (
        <Cartao>
          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <div className="flex items-center gap-2 text-sm text-erro"><span className="animate-pulse h-2.5 w-2.5 rounded-full bg-erro" />{fase === 'gravando' ? 'Gravando' : 'Finalizando'}</div>
            <p className="numero text-6xl">{formatarTempo(segundos)}</p>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {(Object.keys(niveis) as Trilha[]).map((t) => (
                <div key={t} className="flex items-center gap-3 text-xs">
                  <span className="w-20 text-right text-texto-2">{t === 'cliente' ? 'Cliente (aba)' : t === 'vendedor' ? 'Você' : 'Microfone'}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-superficie-2">
                    <div className="h-full rounded-full bg-coach transition-[width] duration-100" style={{ width: `${Math.round((niveis[t] ?? 0) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-texto-2">
              A cada 5 minutos um pedaço é salvo e transcrito. <span className="numero">{enviados}</span> salvo(s)
              {fila.pendentes > 0 && <> · <span className="numero">{fila.pendentes}</span> na fila</>}
              {fila.falhas > 0 && <> · <span className="numero text-erro">{fila.falhas}</span> com falha</>}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {fase === 'gravando' && <Botao variante="perigo" onClick={encerrar}>■ Encerrar e analisar</Botao>}
              {fase === 'finalizando' && fila.falhas > 0 && <Botao onClick={() => { filaRef.current?.tentarFalhas(); setErro(''); }}>Tentar de novo</Botao>}
              {fase === 'finalizando' && !fila.enviando && fila.pendentes === 0 && enviados > 0 && <Botao variante="principal" onClick={analisar}>Analisar o que foi salvo</Botao>}
            </div>
          </div>
        </Cartao>
      )}

      {(fase === 'enviando-arquivo' || fase === 'transcrevendo' || fase === 'analisando') && (
        <Cartao>
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="font-medium">
              {fase === 'enviando-arquivo' ? 'Enviando a gravação…' : fase === 'transcrevendo' ? 'Transcrevendo…' : 'Analisando a reunião…'}
            </p>
            <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-superficie-2">
              <div className="h-full rounded-full gradiente-atena transition-[width] duration-300" style={{ width: `${fase === 'enviando-arquivo' ? progresso.pct : fase === 'transcrevendo' ? (progresso.total ? (progresso.feitas / progresso.total) * 100 : 5) : 90}%` }} />
            </div>
            <p className="text-sm text-texto-2">
              {fase === 'transcrevendo' && progresso.total > 0 ? `Parte ${progresso.feitas} de ${progresso.total}. ` : ''}
              Pode levar alguns minutos. Não feche esta aba.
            </p>
            {erro && reuniaoId.current && fase === 'transcrevendo' && <Botao onClick={transcreverArquivo}>Tentar de novo</Botao>}
          </div>
        </Cartao>
      )}
    </div>
  );
}

/** PUT direto pro Storage com barra de progresso. */
function subir(url: string, arquivo: File, cabecalhos: Record<string, string>, aoProgresso: (pct: number) => void) {
  return new Promise<void>((ok, falha) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    for (const [k, v] of Object.entries(cabecalhos)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => e.lengthComputable && aoProgresso(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status < 300 ? ok() : falha(new Error(`O envio falhou (${x.status}).`)));
    x.onerror = () => falha(new Error('O envio falhou. Confira a internet.'));
    x.send(arquivo);
  });
}
