// Regras puras da gravação e do envio de arquivo.
import type { ModoGravacao, Pedaco, Trilha } from './tipos';

/** Tamanho de cada pedaço gravado no navegador: 5 minutos. */
export const PEDACO_SEG = 5 * 60;

/** Limite do envio de arquivo já gravado. */
export const LIMITE_ARQUIVO_BYTES = 200 * 1024 * 1024;

/** Tamanho da janela de transcrição de arquivo longo no servidor (10 min). */
export const JANELA_ARQUIVO_SEG = 10 * 60;

const MIMES_ACEITOS = [
  'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/wav',
  'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/opus', 'audio/flac',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
];

export function validarArquivo(arq: { nome: string; mime: string; bytes: number }): string | null {
  if (arq.bytes <= 0) return 'O arquivo está vazio.';
  if (arq.bytes > LIMITE_ARQUIVO_BYTES) return 'O arquivo passa de 200 MB. Corte em partes ou comprima antes de enviar.';
  const mime = arq.mime.toLowerCase().split(';')[0].trim();
  if (MIMES_ACEITOS.includes(mime)) return null;
  const ext = arq.nome.toLowerCase().split('.').pop() ?? '';
  if (['mp3', 'm4a', 'wav', 'webm', 'ogg', 'opus', 'flac', 'aac', 'mp4', 'mov', 'mkv'].includes(ext)) return null;
  return 'Formato não aceito. Envie áudio (mp3, m4a, wav, ogg, webm) ou vídeo (mp4, mov, webm).';
}

/** Janelas [inicio, fim) para transcrever um arquivo longo em partes. */
export function janelasDeTranscricao(duracaoSeg: number, janelaSeg = JANELA_ARQUIVO_SEG): { inicioSeg: number; fimSeg: number }[] {
  const out: { inicioSeg: number; fimSeg: number }[] = [];
  const total = Math.max(0, Math.ceil(duracaoSeg));
  for (let i = 0; i < total; i += janelaSeg) out.push({ inicioSeg: i, fimSeg: Math.min(total, i + janelaSeg) });
  return out;
}

/** Quais trilhas o modo grava. */
export function trilhasDoModo(modo: ModoGravacao): Trilha[] {
  if (modo === 'duas-trilhas') return ['vendedor', 'cliente'];
  return ['misto'];
}

/**
 * Verifica o que veio do getDisplayMedia: se o usuário não marcou "compartilhar áudio da guia",
 * a stream vem sem trilha de áudio. Recebe só o número de trilhas pra ser testável.
 */
export function avisoAudioDaAba(trilhasDeAudioDaAba: number): string | null {
  if (trilhasDeAudioDaAba > 0) return null;
  return 'Veio sem o áudio da aba: só a sua voz vai ser gravada. Para gravar o cliente, compartilhe a guia da reunião e marque "Compartilhar áudio da guia".';
}

/** Próximo índice e início de um pedaço novo da trilha (andamento salvo). */
export function proximoPedaco(pedacos: Pedaco[], trilha: Trilha): { indice: number; inicioSeg: number } {
  const daTrilha = pedacos.filter((p) => p.trilha === trilha);
  if (daTrilha.length === 0) return { indice: 0, inicioSeg: 0 };
  const ult = daTrilha.reduce((a, b) => (b.indice > a.indice ? b : a));
  return { indice: ult.indice + 1, inicioSeg: ult.inicioSeg + ult.duracaoSeg };
}

/**
 * Coloca (ou substitui) um pedaço na lista. Mesmo (trilha, índice) = reenvio → substitui.
 * Mantém a ordem por trilha e índice.
 */
export function registrarPedaco(pedacos: Pedaco[], novo: Pedaco): Pedaco[] {
  const resto = pedacos.filter((p) => !(p.trilha === novo.trilha && p.indice === novo.indice));
  return [...resto, novo].sort((a, b) => a.trilha.localeCompare(b.trilha) || a.indice - b.indice);
}

/** Resumo do andamento pra tela ("3 de 4 pedaços transcritos"). */
export function andamento(pedacos: Pedaco[]): { total: number; transcritos: number; comErro: number; pronto: boolean } {
  const total = pedacos.length;
  const transcritos = pedacos.filter((p) => p.status === 'transcrito').length;
  const comErro = pedacos.filter((p) => p.status === 'erro').length;
  return { total, transcritos, comErro, pronto: total > 0 && transcritos + comErro === total && transcritos > 0 };
}
