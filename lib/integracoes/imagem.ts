// Integração de geração de imagem e vídeo (Gemini) — usada pelo Estúdio.
// Com SIMULAR=1 devolve imagens/vídeos de exemplo, sem rede e sem chave.
//
// Formato da API (doc oficial Google AI "Image generation"; vídeo = Gemini Omni Flash, o mesmo formato já
// usado ao vivo na LB em out/2026 — o Veo saiu do ar em out/2026 e dá 404 "use gemini-omni-1.1-flash"):
// - Imagem: POST https://generativelanguage.googleapis.com/v1beta/models/{modelo}:generateContent
//   header x-goog-api-key; body { contents:[{ parts:[{text}, {inline_data:{mime_type, data(base64)}}...] }],
//   generationConfig:{ responseModalities:['IMAGE'], imageConfig:{ aspectRatio:'1:1'|'3:4'|'4:5'|'9:16' } } }
//   resposta: candidates[0].content.parts[].inlineData { mimeType, data }
// - Vídeo (Omni): POST https://generativelanguage.googleapis.com/v1beta/interactions
//   body { model, input:[{ type:'user_input', content:[{type:'image', mime_type, data}, {type:'text', text}] }],
//          response_format:{ type:'video', aspect_ratio:'9:16', delivery:'uri' }, background:true }
//   resposta: { id } → GET .../v1beta/interactions/{id} até steps[].type 'model_output' trazer content type 'video'
//   ({ uri } ou { data }); status completed/failed/cancelled/incomplete sem vídeo = bloqueado/falhou.
//   O uri é do Files API (/v1beta/files/x) e só baixa com x-goog-api-key em /download/...:download?alt=media.

export type Proporcao = '1:1' | '3:4' | '4:5' | '9:16';

export interface PedidoImagem {
  prompt: string;
  /** Fotos de referência como data URL (data:image/jpeg;base64,...). */
  referencias: string[];
  proporcao: Proporcao;
  quantidade: number;
  /** Só para o modo simulado ficar parecido com a marca. */
  cores?: { primaria: string; secundaria: string };
  estilo?: string;
}

export interface ResultadoImagem {
  imagens: string[]; // data URLs
  falhas: number;
  erros: string[];
}

export interface PedidoVideo {
  prompt: string;
  foto: string; // data URL
  proporcao: '9:16' | '1:1';
  duracaoSeg: number;
}

export type EstadoVideo = { pronto: false; erro?: undefined } | { pronto: true; url: string; erro?: undefined } | { pronto: true; erro: string; url?: undefined };

export const simulando = () => process.env.SIMULAR === '1';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
// CONFIRMAR AO VIVO: nomes dos modelos (dá para trocar por variável de ambiente sem mexer no código).
const MODELO_IMAGEM = () => process.env.GEMINI_MODELO_IMAGEM || 'gemini-2.5-flash-image';
const MODELO_VIDEO = () => process.env.GEMINI_MODELO_VIDEO || 'gemini-omni-1.1-flash';

function chave(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY não configurada (ou use SIMULAR=1).');
  return k;
}

export function dividirDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('Foto em formato inválido.');
  return { mimeType: m[1], base64: m[2] };
}

export async function gerarImagens(p: PedidoImagem): Promise<ResultadoImagem> {
  if (simulando()) return simularImagens(p);
  const imagens: string[] = [];
  const erros: string[] = [];
  // Uma chamada por variação (a API devolve normalmente 1 imagem por resposta).
  const tarefas = Array.from({ length: p.quantidade }, async (_, i) => {
    try {
      const parts: unknown[] = [{ text: p.quantidade > 1 ? `${p.prompt}\nVariação ${i + 1} de ${p.quantidade}: mude só o enquadramento/cenário.` : p.prompt }];
      for (const r of p.referencias) {
        const { mimeType, base64 } = dividirDataUrl(r);
        parts.push({ inline_data: { mime_type: mimeType, data: base64 } });
      }
      const resp = await fetch(`${BASE}/models/${MODELO_IMAGEM()}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': chave() },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: p.proporcao } },
        }),
      });
      if (!resp.ok) throw new Error(`Gemini ${resp.status}`);
      const json = (await resp.json()) as GeminiResposta;
      const img = json.candidates?.[0]?.content?.parts?.find((x) => x.inlineData?.data)?.inlineData;
      if (!img) throw new Error('Sem imagem na resposta');
      imagens.push(`data:${img.mimeType || 'image/png'};base64,${img.data}`);
    } catch (e) {
      erros.push(e instanceof Error ? e.message : String(e));
    }
  });
  await Promise.all(tarefas);
  return { imagens, falhas: p.quantidade - imagens.length, erros };
}

/** Corpo do pedido de vídeo pro Omni (foto do produto + roteiro). Puro, testado. */
export function pedidoVideoOmni(p: PedidoVideo, modelo = MODELO_VIDEO()) {
  const { mimeType, base64 } = dividirDataUrl(p.foto);
  return {
    model: modelo,
    input: [{ type: 'user_input', content: [
      { type: 'image', mime_type: mimeType, data: base64 },
      // O Omni não tem campo de duração: vai no texto.
      { type: 'text', text: `${p.prompt}\nDuração do vídeo: cerca de ${p.duracaoSeg} segundos.` },
    ] }],
    // Confirmado ao vivo na LB: 9:16. CONFIRMAR AO VIVO: 1:1 (se o Omni recusar, cair pra 9:16).
    response_format: { type: 'video', aspect_ratio: p.proporcao, delivery: 'uri' },
    background: true,
  };
}

/** Lê a interação do Omni (REST). Puro, testado. */
export function lerInteracaoVideo(j: OmniInteracao): EstadoVideo {
  if (j?.error) return { pronto: true, erro: j.error.message || 'Falha no vídeo' };
  const saida = (j?.steps || []).filter((s) => s.type === 'model_output').flatMap((s) => s.content || []);
  const v = saida.find((c) => c.type === 'video');
  if (v?.uri) return { pronto: true, url: v.uri };
  if (v?.data) return { pronto: true, url: `data:${v.mime_type || 'video/mp4'};base64,${v.data}` };
  const st = String(j?.status || '').toLowerCase();
  if (['completed', 'failed', 'cancelled', 'incomplete'].includes(st)) {
    const txt = saida.filter((c) => c.type === 'text').map((c) => c.text).join(' ').trim();
    return { pronto: true, erro: txt || 'O Google não devolveu o vídeo (pode ter sido bloqueado pelo filtro de segurança).' };
  }
  return { pronto: false };
}

/** Link de download de um arquivo do Files API (precisa do x-goog-api-key). */
export function urlDownloadVideo(uri: string): string {
  return /\/v1beta\/files\/[\w-]+$/.test(uri) ? uri.replace('/v1beta/files/', '/download/v1beta/files/') + ':download?alt=media' : uri;
}

export async function iniciarVideo(p: PedidoVideo): Promise<{ operacao: string }> {
  if (simulando()) return { operacao: `simulado/${p.proporcao}/${Date.now()}` };
  const resp = await fetch(`${BASE}/interactions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': chave() },
    body: JSON.stringify(pedidoVideoOmni(p)),
  });
  if (!resp.ok) throw new Error(`Omni ${resp.status}`);
  const json = (await resp.json()) as { id?: string };
  if (!json.id) throw new Error('Omni não devolveu o id do vídeo.');
  return { operacao: `omni/${json.id}` };
}

export async function consultarVideo(operacao: string): Promise<EstadoVideo> {
  if (operacao.startsWith('simulado/')) {
    const proporcao = operacao.split('/')[1] === '1:1' ? '1:1' : '9:16';
    return { pronto: true, url: videoSimulado(proporcao) };
  }
  const id = operacao.replace(/^omni\//, '');
  if (!/^[\w-]+$/.test(id)) return { pronto: true, erro: 'Vídeo antigo (do Veo, que saiu do ar). Gere de novo.' };
  const resp = await fetch(`${BASE}/interactions/${id}`, { headers: { 'x-goog-api-key': chave() } });
  if (!resp.ok) return { pronto: true, erro: `Omni ${resp.status}` };
  // CONFIRMAR AO VIVO: baixar o arquivo (urlDownloadVideo + chave) e guardar no Storage da empresa (o uri expira em ~2 dias).
  return lerInteracaoVideo((await resp.json()) as OmniInteracao);
}

interface GeminiResposta {
  candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] } }[];
}
interface OmniInteracao {
  status?: string;
  error?: { message?: string };
  steps?: { type?: string; content?: { type?: string; uri?: string; data?: string; mime_type?: string; text?: string }[] }[];
}

// ---------- Modo simulado ----------

const DIM: Record<Proporcao, [number, number]> = { '1:1': [1080, 1080], '3:4': [1080, 1440], '4:5': [1080, 1350], '9:16': [1080, 1920] };

const CENARIOS = [
  ['#F4EFE6', '#E6DCCB'],
  ['#E9EEF5', '#CBD6E6'],
  ['#EFE7F3', '#D9C8E3'],
  ['#E8F1EC', '#C9DFD2'],
  ['#F5ECE6', '#E7CFC0'],
  ['#ECECEC', '#D2D2D2'],
];

/** Gera SVGs de exemplo: a foto enviada sobre um cenário diferente por variação. */
export function simularImagens(p: PedidoImagem): ResultadoImagem {
  const [w, h] = DIM[p.proporcao];
  const imagens = Array.from({ length: p.quantidade }, (_, i) => {
    const [c1, c2] = CENARIOS[i % CENARIOS.length];
    const ref = p.referencias[i % Math.max(1, p.referencias.length)];
    const acento = p.cores?.primaria ?? '#3B5BDB';
    const lado = Math.round(Math.min(w, h) * 0.62);
    const x = (w - lado) / 2;
    const y = (h - lado) / 2;
    const produto = ref
      ? `<image href="${ref}" x="${x}" y="${y}" width="${lado}" height="${lado}" preserveAspectRatio="xMidYMid meet"/>`
      : `<circle cx="${w * 0.3}" cy="${h * 0.3}" r="${w * 0.22}" fill="${p.cores?.secundaria ?? '#7048E8'}" opacity="0.18"/><circle cx="${w * 0.62}" cy="${h * 0.22}" r="${w * 0.12}" fill="${acento}" opacity="0.22"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
<radialGradient id="s" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<rect width="${w}" height="${h}" fill="url(#g)"/>
<circle cx="${w * 0.85}" cy="${h * 0.12}" r="${w * 0.35}" fill="${acento}" opacity="0.07"/>
${ref ? `<ellipse cx="${w / 2}" cy="${y + lado * 0.98}" rx="${lado * 0.42}" ry="${lado * 0.06}" fill="url(#s)"/>` : ''}
${produto}
</svg>`;
    return svgParaDataUrl(svg);
  });
  return { imagens, falhas: 0, erros: [] };
}

export function svgParaDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

/** Vídeo de exemplo: SVG animado (SMIL) — serve de prévia no modo simulado. */
export function videoSimulado(proporcao: '9:16' | '1:1'): string {
  const [w, h] = DIM[proporcao];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E8A93B"/><stop offset="1" stop-color="#7048E8"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="#0E1116"/>
<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.25}" fill="url(#g)"><animate attributeName="r" values="${w * 0.22};${w * 0.3};${w * 0.22}" dur="6s" repeatCount="indefinite"/></circle>
<rect x="0" y="0" width="${w * 0.2}" height="${h}" fill="#fff" opacity="0.08"><animate attributeName="x" from="${-w * 0.2}" to="${w}" dur="3s" repeatCount="indefinite"/></rect>
</svg>`;
  return svgParaDataUrl(svg);
}
