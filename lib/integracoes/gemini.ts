// Integração com o Gemini — TRANSCRIÇÃO de áudio do Coach (sessão C).
// (Geração de imagem/vídeo do Estúdio fica em lib/integracoes/imagem.ts, sessão D.)
//
// Modo simulado: SIMULAR=1 (ou sem GEMINI_API_KEY) → devolve falas de exemplo, sem rede.
//
// Formato da API, conforme a documentação oficial (ai.google.dev/api), lido em 01/11/2026:
// - generateContent:  POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent
//   cabeçalho "x-goog-api-key: <chave>", corpo:
//   { contents: [{ role: 'user', parts: [{ inline_data: { mime_type, data: <base64> } }, { text }] }],
//     generationConfig: { responseMimeType: 'application/json', responseSchema: {...} } }
//   Resposta: candidates[0].content.parts[].text
//   Áudio inline: request inteiro até 20 MB → serve pros pedaços de 5 min gravados no navegador.
// - Arquivos grandes: Files API (upload resumível), até 2 GB, guardado 48 h:
//   POST https://generativelanguage.googleapis.com/upload/v1beta/files
//     cabeçalhos X-Goog-Upload-Protocol: resumable, X-Goog-Upload-Command: start,
//     X-Goog-Upload-Header-Content-Length, X-Goog-Upload-Header-Content-Type; corpo { file: { display_name } }
//     → resposta traz o cabeçalho X-Goog-Upload-URL
//   POST <upload-url> com X-Goog-Upload-Command: upload, finalize e X-Goog-Upload-Offset: 0, corpo = bytes
//     → { file: { name, uri, state, mimeType } }; esperar state === 'ACTIVE' (GET /v1beta/{name}).
//   Depois usar parts: [{ file_data: { mime_type, file_uri } }] no generateContent.
// - Timestamps: a doc diz que dá pra pedir trechos por "MM:SS" no prompt.
// CONFIRMAR AO VIVO: nomes exatos dos campos (snake_case x camelCase são aceitos pela API REST),
// precisão dos tempos devolvidos pelo modelo e limite de saída por chamada.
import type { Fala, Falante, Trilha } from '../coach/tipos';

const BASE = 'https://generativelanguage.googleapis.com';
export const MODELO_TRANSCRICAO = process.env.GEMINI_MODELO_TRANSCRICAO || 'gemini-2.5-flash';

export function simulando(): boolean {
  return process.env.SIMULAR === '1' || !process.env.GEMINI_API_KEY;
}

export interface PedidoTranscricao {
  trilha: Trilha;
  /** Só pro modo simulado variar o texto. */
  indice?: number;
  duracaoSeg?: number;
}

/** Instrução pro modelo. Na trilha única ("misto") ele precisa separar vendedor e cliente. */
export function promptTranscricao(trilha: Trilha, janela?: { inicioSeg: number; fimSeg: number }): string {
  const quem =
    trilha === 'misto'
      ? 'O áudio tem o vendedor e o cliente no mesmo microfone. Marque "quem" como "vendedor" (quem apresenta e vende) ou "cliente"; se não der pra saber, "desconhecido".'
      : `Todo este áudio é de uma pessoa só: o ${trilha}. Marque "quem" como "${trilha}".`;
  const trecho = janela
    ? ` Transcreva SOMENTE o trecho de ${mmss(janela.inicioSeg)} até ${mmss(janela.fimSeg)}; os tempos continuam contando desde o início do arquivo.`
    : '';
  return `Transcreva este áudio de uma reunião de vendas em português do Brasil, palavra por palavra, sem resumir.${trecho}
${quem}
Divida em falas (frases ou trechos de até ~20 s). Para cada fala dê inicioSeg e fimSeg em segundos (número) desde o início do áudio.
Ignore silêncio, música e ruído. Se não houver fala, devolva {"falas": []}.
Responda só com JSON: {"falas":[{"quem":"vendedor|cliente|desconhecido","inicioSeg":0,"fimSeg":0,"texto":"..."}]}`;
}

const SCHEMA_RESPOSTA = {
  type: 'OBJECT',
  properties: {
    falas: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          quem: { type: 'STRING', enum: ['vendedor', 'cliente', 'desconhecido'] },
          inicioSeg: { type: 'NUMBER' },
          fimSeg: { type: 'NUMBER' },
          texto: { type: 'STRING' },
        },
        required: ['quem', 'inicioSeg', 'fimSeg', 'texto'],
      },
    },
  },
  required: ['falas'],
};

/**
 * Lê a resposta do modelo de forma tolerante e devolve falas no tempo do ÁUDIO (sem deslocamento).
 * Na trilha vendedor/cliente o "quem" é forçado pela trilha (não depende da IA).
 */
export function lerFalas(texto: string, trilha: Trilha): Fala[] {
  let t = (texto || '').trim();
  const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cerca) t = cerca[1];
  let dados: unknown = null;
  try {
    dados = JSON.parse(t);
  } catch {
    const i = t.search(/[[{]/);
    if (i >= 0) {
      try {
        dados = JSON.parse(t.slice(i).replace(/,\s*([}\]])/g, '$1'));
      } catch {
        dados = null;
      }
    }
  }
  const lista = Array.isArray(dados) ? dados : Array.isArray((dados as { falas?: unknown })?.falas) ? (dados as { falas: unknown[] }).falas : [];
  const falas: Fala[] = [];
  for (const item of lista) {
    const x = item as Record<string, unknown>;
    const texto = typeof x?.texto === 'string' ? x.texto.trim() : typeof x?.text === 'string' ? (x.text as string).trim() : '';
    if (!texto) continue;
    const ini = paraSeg(x.inicioSeg ?? x.inicio ?? x.start);
    const fim = paraSeg(x.fimSeg ?? x.fim ?? x.end);
    if (ini === null) continue;
    const quemIA = String(x.quem ?? x.speaker ?? '').toLowerCase();
    const quem: Falante =
      trilha !== 'misto' ? trilha : quemIA.startsWith('vend') ? 'vendedor' : quemIA.startsWith('cli') ? 'cliente' : 'desconhecido';
    falas.push({ quem, trilha, inicioSeg: ini, fimSeg: Math.max(ini, fim ?? ini + Math.max(1, texto.split(/\s+/).length / 2.5)), texto });
  }
  return falas.sort((a, b) => a.inicioSeg - b.inicioSeg);
}

function paraSeg(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v !== 'string' || !v.trim()) return null;
  const m = v.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{2}(?:\.\d+)?)$/);
  if (m) return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, n) : null;
}

function mmss(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ---------- Simulado ----------

const ROTEIRO_SIMULADO: [Falante, string][] = [
  ['vendedor', 'Oi, tudo bem? Obrigado por separar esse tempo. Como você conheceu a gente?'],
  ['cliente', 'Vi um anúncio no Instagram e uma amiga indicou também.'],
  ['vendedor', 'Que bom! Me conta, o que fez você procurar isso agora?'],
  ['cliente', 'Estou perdendo muito cliente porque demoro pra responder no WhatsApp.'],
  ['vendedor', 'E o que acontece se não resolver isso nos próximos meses?'],
  ['cliente', 'Vou continuar perdendo venda, e a equipe está sobrecarregada.'],
  ['vendedor', 'Entendi. Deixa eu te mostrar como funciona a apresentação da solução na prática.'],
  ['cliente', 'Legal, faz sentido pra mim.'],
  ['vendedor', 'O investimento fica em 397 reais por mês. Cabe no que você planejou?'],
  ['cliente', 'Achei um pouco caro, vou pensar e falar com meu sócio.'],
  ['vendedor', 'Claro. Além disso, tem mais alguma coisa que te impede de começar?'],
  ['cliente', 'Não, é mais o preço mesmo.'],
  ['vendedor', 'Posso te ligar quinta às dez pra gente fechar com seu sócio junto?'],
  ['cliente', 'Pode sim, quinta às dez está ótimo.'],
];

/** Falas de exemplo, determinísticas, distribuídas na duração do pedaço. */
export function transcricaoSimulada(p: PedidoTranscricao): Fala[] {
  const dur = p.duracaoSeg ?? 300;
  const base = ((p.indice ?? 0) * 4) % ROTEIRO_SIMULADO.length;
  const linhas = Array.from({ length: 6 }, (_, i) => ROTEIRO_SIMULADO[(base + i) % ROTEIRO_SIMULADO.length]).filter(
    ([quem]) => p.trilha === 'misto' || quem === p.trilha,
  );
  const passo = dur / Math.max(1, linhas.length + 1);
  return linhas.map(([quem, texto], i) => ({
    quem: p.trilha === 'misto' ? quem : (p.trilha as Falante),
    trilha: p.trilha,
    inicioSeg: Math.round(passo * i * 10) / 10,
    fimSeg: Math.round((passo * i + Math.min(passo * 0.9, 12)) * 10) / 10,
    texto,
  }));
}

// ---------- Real ----------

async function gerar(parts: unknown[], fetcher: typeof fetch = fetch): Promise<string> {
  const chave = process.env.GEMINI_API_KEY!;
  const r = await fetcher(`${BASE}/v1beta/models/${MODELO_TRANSCRICAO}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA_RESPOSTA },
    }),
  });
  if (!r.ok) throw new Error(`Gemini respondeu ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? '').join('');
}

/** Transcreve um pedaço curto (até ~15 MB) mandando o áudio inline. Tempos relativos ao pedaço. */
export async function transcreverPedaco(
  audio: Uint8Array,
  mime: string,
  pedido: PedidoTranscricao,
  fetcher?: typeof fetch,
): Promise<Fala[]> {
  if (simulando()) return transcricaoSimulada(pedido);
  const data = Buffer.from(audio).toString('base64');
  const texto = await gerar(
    [{ inline_data: { mime_type: mime.split(';')[0], data } }, { text: promptTranscricao(pedido.trilha) }],
    fetcher,
  );
  return lerFalas(texto, pedido.trilha);
}

/** Sobe um arquivo grande pra Files API e espera ficar ACTIVE. CONFIRMAR AO VIVO. */
export async function enviarArquivoGemini(bytes: Uint8Array, mime: string, nome: string, fetcher: typeof fetch = fetch) {
  const chave = process.env.GEMINI_API_KEY!;
  const ini = await fetcher(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': chave,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.byteLength),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: nome } }),
  });
  const url = ini.headers.get('x-goog-upload-url');
  if (!ini.ok || !url) throw new Error(`Falha ao iniciar upload no Gemini (${ini.status})`);
  const up = await fetcher(url, {
    method: 'POST',
    headers: { 'X-Goog-Upload-Command': 'upload, finalize', 'X-Goog-Upload-Offset': '0', 'Content-Length': String(bytes.byteLength) },
    body: bytes as unknown as BodyInit,
  });
  if (!up.ok) throw new Error(`Falha no upload pro Gemini (${up.status})`);
  let arq = ((await up.json()) as { file: { name: string; uri: string; state: string; mimeType: string } }).file;
  for (let i = 0; i < 60 && arq.state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const g = await fetcher(`${BASE}/v1beta/${arq.name}`, { headers: { 'x-goog-api-key': chave } });
    arq = (await g.json()) as typeof arq;
  }
  if (arq.state !== 'ACTIVE') throw new Error(`Arquivo no Gemini ficou em ${arq.state}`);
  return arq;
}

/**
 * Transcreve um arquivo já enviado à Files API, em janelas (partes), pra não estourar a saída.
 * Tempos devolvidos já são do arquivo inteiro.
 */
export async function transcreverArquivo(
  arquivo: { uri: string; mimeType: string } | null,
  janelas: { inicioSeg: number; fimSeg: number }[],
  trilha: Trilha = 'misto',
  fetcher?: typeof fetch,
  aoAvancar?: (feitas: number, total: number) => void | Promise<void>,
): Promise<Fala[]> {
  const todas: Fala[] = [];
  for (let i = 0; i < janelas.length; i++) {
    const j = janelas[i];
    if (simulando() || !arquivo) {
      todas.push(
        ...transcricaoSimulada({ trilha, indice: i, duracaoSeg: j.fimSeg - j.inicioSeg }).map((f) => ({
          ...f, inicioSeg: f.inicioSeg + j.inicioSeg, fimSeg: f.fimSeg + j.inicioSeg,
        })),
      );
    } else {
      const texto = await gerar([{ file_data: { mime_type: arquivo.mimeType, file_uri: arquivo.uri } }, { text: promptTranscricao(trilha, j) }], fetcher);
      // o modelo às vezes repete falas da borda: fica só o que começa dentro da janela
      todas.push(...lerFalas(texto, trilha).filter((f) => f.inicioSeg >= j.inicioSeg - 1 && f.inicioSeg < j.fimSeg));
    }
    await aoAvancar?.(i + 1, janelas.length);
  }
  return todas;
}

// ---------- Áudio do cliente no WhatsApp (Atendimento) ----------

/** Texto de exemplo do modo simulado (o cliente "falou" isto no áudio). */
export const AUDIO_CLIENTE_SIMULADO = 'Oi, tudo bem? Queria saber se tem horário amanhã à tarde e quanto custa.';

/**
 * Transcreve um áudio curto que o cliente mandou no WhatsApp (OGG/Opus, em geral < 1 min) e devolve só o texto.
 * Usa a mesma chamada inline do Coach (generateContent com inline_data), trilha 'cliente'. CONFIRMAR AO VIVO com áudio real da Meta.
 */
export async function transcreverAudioCliente(audio: Uint8Array, mime: string, fetcher?: typeof fetch): Promise<string | null> {
  if (simulando()) return AUDIO_CLIENTE_SIMULADO;
  const falas = await transcreverPedaco(audio, mime || 'audio/ogg', { trilha: 'cliente' }, fetcher);
  const texto = falas.map((f) => f.texto.trim()).filter(Boolean).join(' ');
  return texto || null;
}

/** Duração aproximada de um áudio do WhatsApp pelo tamanho (Opus ~16 kbps), só para estimar custo. */
export function segundosAproxAudio(bytes: number): number {
  return Math.max(1, Math.round(bytes / 2000));
}
