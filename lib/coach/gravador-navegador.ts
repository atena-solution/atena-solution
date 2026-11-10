// Gravador da reunião no NAVEGADOR (só roda no cliente).
// Duas trilhas: microfone (vendedor) + áudio da aba (cliente, via getDisplayMedia com "compartilhar áudio da guia").
// Ou só microfone (presencial / viva-voz). A cada 5 min fecha um pedaço (arquivo completo) e entrega pra envio.
// Por que parar e reiniciar o MediaRecorder em vez de usar timeslice: com timeslice só o 1º pedaço tem cabeçalho
// do webm; pedaços soltos não tocam nem transcrevem. Reiniciando, cada pedaço é um arquivo válido.
import { avisoAudioDaAba, PEDACO_SEG } from './gravacao';
import type { ModoGravacao, Trilha } from './tipos';

export interface PedacoGravado {
  trilha: Trilha;
  indice: number;
  inicioSeg: number;
  duracaoSeg: number;
  blob: Blob;
}

export interface OpcoesGravador {
  modo: Exclude<ModoGravacao, 'arquivo'>;
  aoPedaco: (p: PedacoGravado) => void;
  aoAviso?: (texto: string) => void;
  /** Volume 0–1 por trilha, ~10x por segundo (pra mostrar que está captando). */
  aoNivel?: (trilha: Trilha, nivel: number) => void;
  pedacoSeg?: number;
}

export function mimeSuportado(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export function navegadorSuporta(modo: OpcoesGravador['modo']): string | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'Este navegador não deixa gravar áudio. Use o Chrome ou o Edge no computador.';
  if (!mimeSuportado()) return 'Este navegador não grava áudio. Use o Chrome ou o Edge.';
  if (modo === 'duas-trilhas' && !navigator.mediaDevices.getDisplayMedia) return 'Gravar o áudio da aba só funciona no Chrome ou Edge no computador. Use "Só microfone".';
  return null;
}

interface Trecho {
  trilha: Trilha;
  stream: MediaStream;
  rec?: MediaRecorder;
  indice: number;
  inicioMs: number;
  timer?: ReturnType<typeof setTimeout>;
  fim?: Promise<void>;
}

export class GravadorReuniao {
  private trechos: Trecho[] = [];
  private extras: MediaStream[] = [];
  private t0 = 0;
  private ativo = false;
  private audioCtx?: AudioContext;
  private medidor?: ReturnType<typeof setInterval>;
  private mime = mimeSuportado();

  constructor(private o: OpcoesGravador) {}

  /** Pede as permissões e começa. Devolve se veio sem o áudio da aba. */
  async iniciar(): Promise<{ semAudioDaAba: boolean }> {
    const erro = navegadorSuporta(this.o.modo);
    if (erro) throw new Error(erro);
    const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    let semAudioDaAba = false;
    const trilhas: { trilha: Trilha; stream: MediaStream }[] = [];

    if (this.o.modo === 'duas-trilhas') {
      let tela: MediaStream | null = null;
      try {
        // Chrome exige vídeo junto; o vídeo não é gravado.
        tela = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true } as DisplayMediaStreamOptions);
      } catch {
        tela = null;
      }
      const aba = tela?.getAudioTracks() ?? [];
      const aviso = avisoAudioDaAba(aba.length);
      if (aviso) {
        semAudioDaAba = true;
        this.o.aoAviso?.(aviso);
        tela?.getTracks().forEach((t) => t.stop());
        trilhas.push({ trilha: 'vendedor', stream: mic });
      } else {
        this.extras.push(tela!);
        trilhas.push({ trilha: 'vendedor', stream: mic });
        const soAudio = new MediaStream(aba);
        trilhas.push({ trilha: 'cliente', stream: soAudio });
        aba[0].addEventListener('ended', () => this.o.aoAviso?.('O compartilhamento da aba parou. Seguimos gravando só o seu microfone.'));
      }
    } else {
      trilhas.push({ trilha: 'misto', stream: mic });
    }

    this.t0 = performance.now();
    this.ativo = true;
    for (const t of trilhas) {
      const tr: Trecho = { trilha: t.trilha, stream: t.stream, indice: 0, inicioMs: this.t0 };
      this.trechos.push(tr);
      this.comecarPedaco(tr);
    }
    this.medirNiveis();
    return { semAudioDaAba };
  }

  segundos(): number {
    return this.ativo ? (performance.now() - this.t0) / 1000 : 0;
  }

  private comecarPedaco(tr: Trecho) {
    if (!this.ativo || tr.stream.getAudioTracks().every((t) => t.readyState === 'ended')) return;
    const partes: Blob[] = [];
    const rec = new MediaRecorder(tr.stream, this.mime ? { mimeType: this.mime, audioBitsPerSecond: 48000 } : undefined);
    tr.rec = rec;
    tr.inicioMs = performance.now();
    const indice = tr.indice;
    const inicioMs = tr.inicioMs;
    rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
    tr.fim = new Promise<void>((ok) => {
      rec.onstop = () => {
        const blob = new Blob(partes, { type: rec.mimeType || this.mime });
        const duracaoSeg = (performance.now() - inicioMs) / 1000;
        if (blob.size > 0 && duracaoSeg >= 1) {
          this.o.aoPedaco({ trilha: tr.trilha, indice, inicioSeg: Math.max(0, (inicioMs - this.t0) / 1000), duracaoSeg, blob });
        }
        ok();
      };
    });
    rec.start();
    tr.timer = setTimeout(() => {
      tr.indice++;
      rec.stop();
      this.comecarPedaco(tr);
    }, (this.o.pedacoSeg ?? PEDACO_SEG) * 1000);
  }

  private medirNiveis() {
    if (!this.o.aoNivel || typeof AudioContext === 'undefined') return;
    this.audioCtx = new AudioContext();
    const medidores = this.trechos.map((tr) => {
      const a = this.audioCtx!.createAnalyser();
      a.fftSize = 512;
      this.audioCtx!.createMediaStreamSource(tr.stream).connect(a);
      return { tr, a, buf: new Uint8Array(a.fftSize) };
    });
    this.medidor = setInterval(() => {
      for (const m of medidores) {
        m.a.getByteTimeDomainData(m.buf);
        let pico = 0;
        for (const v of m.buf) pico = Math.max(pico, Math.abs(v - 128));
        this.o.aoNivel!(m.tr.trilha, Math.min(1, pico / 64));
      }
    }, 100);
  }

  /** Para tudo e espera os últimos pedaços saírem. */
  async parar(): Promise<void> {
    if (!this.ativo) return;
    this.ativo = false;
    for (const tr of this.trechos) {
      clearTimeout(tr.timer);
      if (tr.rec && tr.rec.state !== 'inactive') tr.rec.stop();
    }
    await Promise.all(this.trechos.map((t) => t.fim));
    for (const s of [...this.trechos.map((t) => t.stream), ...this.extras]) s.getTracks().forEach((t) => t.stop());
    clearInterval(this.medidor);
    await this.audioCtx?.close().catch(() => {});
  }
}

/** Fila de envio: manda um pedaço por vez, tenta 3x com espera crescente; o que falhar fica pra "Tentar de novo". */
export class FilaDeEnvio {
  private fila: PedacoGravado[] = [];
  private rodando = false;
  falhas: PedacoGravado[] = [];

  constructor(
    private enviar: (p: PedacoGravado) => Promise<void>,
    private aoMudar?: (estado: { pendentes: number; falhas: number; enviando: boolean }) => void,
  ) {}

  adicionar(p: PedacoGravado) {
    this.fila.push(p);
    this.avisar();
    void this.rodar();
  }

  tentarFalhas() {
    this.fila.push(...this.falhas);
    this.falhas = [];
    void this.rodar();
  }

  get ocupada() {
    return this.rodando || this.fila.length > 0;
  }

  async esvaziar(): Promise<void> {
    while (this.ocupada) await new Promise((r) => setTimeout(r, 200));
  }

  private avisar() {
    this.aoMudar?.({ pendentes: this.fila.length, falhas: this.falhas.length, enviando: this.rodando });
  }

  private async rodar() {
    if (this.rodando) return;
    this.rodando = true;
    this.avisar();
    while (this.fila.length) {
      const p = this.fila.shift()!;
      let ok = false;
      for (let tentativa = 0; tentativa < 3 && !ok; tentativa++) {
        try {
          await this.enviar(p);
          ok = true;
        } catch {
          await new Promise((r) => setTimeout(r, 1500 * 2 ** tentativa));
        }
      }
      if (!ok) this.falhas.push(p);
      this.avisar();
    }
    this.rodando = false;
    this.avisar();
  }
}

/** Duração de um arquivo de áudio/vídeo lida no navegador (metadados). */
export function lerDuracao(arquivo: File): Promise<number> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(arquivo);
    const el = document.createElement(arquivo.type.startsWith('video') ? 'video' : 'audio');
    el.preload = 'metadata';
    const fim = (d: number) => {
      URL.revokeObjectURL(url);
      ok(Number.isFinite(d) ? d : 0);
    };
    el.onloadedmetadata = () => {
      // webm do Chrome vem com duração Infinity: força ler até o fim
      if (el.duration === Infinity) {
        el.currentTime = 1e9;
        el.ontimeupdate = () => { el.ontimeupdate = null; fim(el.duration); };
      } else fim(el.duration);
    };
    el.onerror = () => fim(0);
    el.src = url;
  });
}
