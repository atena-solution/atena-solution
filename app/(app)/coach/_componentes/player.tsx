'use client';
// Player da reunião: toca os pedaços de cada trilha como se fosse um áudio só.
// A trilha "mestre" (vendedor ou misto) dita o tempo; a do cliente acompanha (corrige se desviar > 0,3 s).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Trilha } from '@/lib/coach/tipos';
import { formatarTempo } from '@/lib/coach/transcricao';

export interface AudioPedaco { trilha: Trilha; indice: number; inicioSeg: number; duracaoSeg: number; url: string }
export interface Marcador { seg: number; rotulo: string }
export interface ControlePlayer { irPara: (seg: number, tocar?: boolean) => void }

function segmentoEm(lista: AudioPedaco[], t: number) {
  return lista.find((p) => t >= p.inicioSeg && t < p.inicioSeg + p.duracaoSeg) ?? null;
}

export const Player = forwardRef<ControlePlayer, { audios: AudioPedaco[]; duracaoSeg: number; marcadores?: Marcador[]; aoTempo?: (t: number) => void }>(
  function Player({ audios, duracaoSeg, marcadores = [], aoTempo }, ref) {
    const porTrilha = useMemo(() => {
      const m = new Map<Trilha, AudioPedaco[]>();
      for (const a of [...audios].sort((x, y) => x.inicioSeg - y.inicioSeg)) m.set(a.trilha, [...(m.get(a.trilha) ?? []), a]);
      return m;
    }, [audios]);
    const trilhas = [...porTrilha.keys()].sort((a) => (a === 'cliente' ? 1 : -1));
    const mestre = trilhas[0];
    const els = useRef<Partial<Record<Trilha, HTMLAudioElement | null>>>({});
    const atual = useRef<Partial<Record<Trilha, AudioPedaco | null>>>({});
    const [t, setT] = useState(0);
    const [tocando, setTocando] = useState(false);
    const [velocidade, setVelocidade] = useState(1);
    const tempo = useRef(0);

    const posicionar = useCallback((seg: number, tocar: boolean) => {
      for (const tr of trilhas) {
        const el = els.current[tr];
        if (!el) continue;
        const s = segmentoEm(porTrilha.get(tr) ?? [], seg);
        if (!s) { el.pause(); atual.current[tr] = null; continue; }
        const ajustar = () => {
          el.currentTime = Math.max(0, seg - s.inicioSeg);
          el.playbackRate = velocidade;
          if (tocar) void el.play().catch(() => {});
        };
        if (atual.current[tr]?.url !== s.url) {
          atual.current[tr] = s;
          el.src = s.url;
          el.addEventListener('loadedmetadata', ajustar, { once: true });
          el.load();
        } else ajustar();
      }
      tempo.current = seg;
      setT(seg);
      aoTempo?.(seg);
    }, [trilhas, porTrilha, velocidade, aoTempo]);

    useImperativeHandle(ref, () => ({ irPara: (seg, tocar = true) => { setTocando(tocar || tocando); posicionar(seg, tocar || tocando); } }), [posicionar, tocando]);

    useEffect(() => { posicionar(0, false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [audios]);
    useEffect(() => { for (const tr of trilhas) { const el = els.current[tr]; if (el) el.playbackRate = velocidade; } }, [velocidade, trilhas]);

    function aoAtualizar() {
      const el = els.current[mestre];
      const s = atual.current[mestre];
      if (!el || !s) return;
      const agora = s.inicioSeg + el.currentTime;
      tempo.current = agora;
      setT(agora);
      aoTempo?.(agora);
      for (const tr of trilhas) {
        if (tr === mestre) continue;
        const e2 = els.current[tr];
        const s2 = atual.current[tr];
        if (!e2) continue;
        if (!s2 || agora < s2.inicioSeg || agora >= s2.inicioSeg + s2.duracaoSeg) { posicionar(agora, !el.paused); continue; }
        if (Math.abs(s2.inicioSeg + e2.currentTime - agora) > 0.3) e2.currentTime = agora - s2.inicioSeg;
      }
    }

    function aoAcabar() {
      const s = atual.current[mestre];
      const prox = s ? s.inicioSeg + s.duracaoSeg + 0.01 : duracaoSeg;
      if (prox >= duracaoSeg) { setTocando(false); return; }
      posicionar(prox, true);
    }

    function alternar() {
      const novo = !tocando;
      setTocando(novo);
      if (novo) posicionar(tempo.current >= duracaoSeg - 0.5 ? 0 : tempo.current, true);
      else for (const tr of trilhas) els.current[tr]?.pause();
    }

    if (audios.length === 0) return <p className="text-sm text-texto-2">Sem áudio salvo pra esta reunião.</p>;
    const pct = duracaoSeg ? (t / duracaoSeg) * 100 : 0;

    return (
      <div className="flex flex-col gap-3">
        {trilhas.map((tr) => (
          <audio key={tr} ref={(el) => { els.current[tr] = el; }} preload="metadata" onTimeUpdate={tr === mestre ? aoAtualizar : undefined} onEnded={tr === mestre ? aoAcabar : undefined} />
        ))}
        <div className="flex items-center gap-3">
          <button onClick={alternar} aria-label={tocando ? 'Pausar' : 'Tocar'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white gradiente-atena focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coach">
            {tocando ? '❚❚' : '▶'}
          </button>
          <div className="relative flex-1">
            <input
              type="range" min={0} max={Math.max(1, duracaoSeg)} step={0.5} value={t} aria-label="Posição"
              onChange={(e) => posicionar(Number(e.target.value), tocando)}
              className="w-full accent-coach"
              style={{ background: `linear-gradient(to right, var(--aba-coach) ${pct}%, transparent ${pct}%)` }}
            />
            {marcadores.map((m, i) => (
              <button
                key={i} title={`${formatarTempo(m.seg)} · ${m.rotulo}`} aria-label={`Objeção em ${formatarTempo(m.seg)}: ${m.rotulo}`}
                onClick={() => posicionar(m.seg, true)}
                className="absolute -top-2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-atencao ring-2 ring-superficie"
                style={{ left: `${(m.seg / Math.max(1, duracaoSeg)) * 100}%` }}
              />
            ))}
          </div>
          <span className="numero w-24 shrink-0 text-right text-xs text-texto-2">{formatarTempo(t)} / {formatarTempo(duracaoSeg)}</span>
          <button onClick={() => setVelocidade((v) => (v >= 2 ? 1 : v + 0.5))} className="numero rounded-md border border-borda px-2 py-1 text-xs" aria-label="Velocidade">{velocidade}×</button>
        </div>
      </div>
    );
  },
);
