// Onde ficam os áudios das reuniões. Todo caminho começa com empresas/{empresaId}/ (isolamento).
// Real: Firebase Storage (Admin SDK). Simulado: memória do servidor + rota /api/coach/audio.
import { createHmac, randomBytes } from 'node:crypto';
import type { getStorage } from 'firebase-admin/storage';

type Bucket = ReturnType<ReturnType<typeof getStorage>['bucket']>;

export interface Armazenamento {
  salvar(caminho: string, bytes: Uint8Array, mime: string): Promise<void>;
  ler(caminho: string): Promise<Uint8Array>;
  /** URL pra tocar no player (assinada no real, 2 h). */
  urlLeitura(caminho: string): Promise<string>;
  /** URL pro navegador subir o arquivo direto (PUT), sem passar pelo servidor. */
  urlEnvio(caminho: string, mime: string): Promise<{ url: string; metodo: 'PUT'; cabecalhos: Record<string, string> }>;
}

/** O caminho pertence à empresa? (usado antes de qualquer leitura/escrita). */
export function caminhoDaEmpresa(caminho: string, empresaId: string): boolean {
  if (!empresaId || caminho.includes('..') || caminho.includes('//')) return false;
  return caminho.startsWith(`empresas/${empresaId}/reunioes/`);
}

/**
 * Assinatura das URLs do modo simulado (imita a URL assinada do Storage: o <audio> e o PUT direto não mandam login).
 * HMAC do caminho + validade com um segredo aleatório do processo.
 */
const g = globalThis as { __coachSegredoUrl?: string };
const SEGREDO_URL = (g.__coachSegredoUrl ??= randomBytes(32).toString('hex'));

export function assinarCaminho(caminho: string, acao: 'ler' | 'enviar', validoAte: number, segredo = SEGREDO_URL): string {
  return createHmac('sha256', segredo).update(`${acao}\n${caminho}\n${validoAte}`).digest('hex').slice(0, 32);
}

export function urlSimulada(caminho: string, acao: 'ler' | 'enviar', agoraMs = Date.now(), segredo = SEGREDO_URL): string {
  const ate = agoraMs + 2 * 3600 * 1000;
  return `/api/coach/audio?c=${encodeURIComponent(caminho)}&a=${acao}&v=${ate}&s=${assinarCaminho(caminho, acao, ate, segredo)}`;
}

/** Confere a URL assinada do modo simulado. */
export function conferirUrlSimulada(sp: URLSearchParams, acao: 'ler' | 'enviar', agoraMs = Date.now(), segredo = SEGREDO_URL): string | null {
  const c = sp.get('c') ?? '';
  const v = Number(sp.get('v'));
  if (sp.get('a') !== acao || !Number.isFinite(v) || v < agoraMs) return null;
  return sp.get('s') === assinarCaminho(c, acao, v, segredo) ? c : null;
}

export function armazenamentoEmMemoria(): Armazenamento & { _dados: Map<string, { bytes: Uint8Array; mime: string }> } {
  const dados = new Map<string, { bytes: Uint8Array; mime: string }>();
  return {
    _dados: dados,
    async salvar(c, bytes, mime) { dados.set(c, { bytes, mime }); },
    async ler(c) {
      const x = dados.get(c);
      if (!x) throw new Error('Arquivo não encontrado.');
      return x.bytes;
    },
    async urlLeitura(c) { return urlSimulada(c, 'ler'); },
    async urlEnvio(c, mime) { return { url: urlSimulada(c, 'enviar'), metodo: 'PUT', cabecalhos: { 'Content-Type': mime } }; },
  };
}

/**
 * Firebase Storage. Doc (cloud.google.com/storage/docs/access-control/signed-urls, lida em 01/11/2026):
 * getSignedUrl({ version: 'v4', action: 'read'|'write', expires, contentType }) — no PUT o navegador
 * precisa mandar o MESMO Content-Type. URL v4 vale no máximo 7 dias.
 * CONFIRMAR AO VIVO: CORS do bucket liberando PUT do domínio da Atena (gsutil cors set).
 */
export function armazenamentoFirebase(bucket: Bucket): Armazenamento {
  return {
    async salvar(c, bytes, mime) {
      await bucket.file(c).save(Buffer.from(bytes), { contentType: mime, resumable: false });
    },
    async ler(c) {
      const [buf] = await bucket.file(c).download();
      return new Uint8Array(buf);
    },
    async urlLeitura(c) {
      const [url] = await bucket.file(c).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 2 * 3600 * 1000 });
      return url;
    },
    async urlEnvio(c, mime) {
      const [url] = await bucket.file(c).getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + 3600 * 1000, contentType: mime });
      return { url, metodo: 'PUT', cabecalhos: { 'Content-Type': mime } };
    },
  };
}
