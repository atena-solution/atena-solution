// Slideshow animado montado no navegador (canvas + MediaRecorder): custo zero de crédito.
// Aqui só a linha do tempo pura; quem desenha é a tela (app/(app)/estudio/video).

export type Transicao = 'cruzar' | 'deslizar' | 'zoom';

export interface Quadro {
  indice: number; // qual foto
  proxima: number | null;
  /** 0..1 dentro da foto atual (para o "Ken Burns"). */
  progresso: number;
  /** 0..1 da transição para a próxima (0 = sem transição). */
  mistura: number;
}

export interface Roteiro {
  fotos: number;
  segundosPorFoto: number;
  segundosTransicao: number;
  transicao: Transicao;
  duracaoTotal: number;
}

export function criarRoteiro(fotos: number, duracaoAlvo = 8, transicao: Transicao = 'cruzar'): Roteiro {
  if (fotos < 1 || fotos > 10) throw new Error('Use de 1 a 10 fotos no slideshow.');
  if (duracaoAlvo < 3 || duracaoAlvo > 30) throw new Error('Duração entre 3 e 30 segundos.');
  const segundosPorFoto = duracaoAlvo / fotos;
  const segundosTransicao = fotos > 1 ? Math.min(0.6, segundosPorFoto * 0.3) : 0;
  return { fotos, segundosPorFoto, segundosTransicao, transicao, duracaoTotal: duracaoAlvo };
}

/** Qual foto mostrar no tempo t (segundos). */
export function quadroEm(r: Roteiro, t: number): Quadro {
  const tt = Math.min(Math.max(0, t), r.duracaoTotal - 1e-6);
  const indice = Math.min(r.fotos - 1, Math.floor(tt / r.segundosPorFoto));
  const dentro = tt - indice * r.segundosPorFoto;
  const progresso = dentro / r.segundosPorFoto;
  const temProxima = indice < r.fotos - 1;
  const inicioTransicao = r.segundosPorFoto - r.segundosTransicao;
  const mistura = temProxima && r.segundosTransicao > 0 && dentro > inicioTransicao ? (dentro - inicioTransicao) / r.segundosTransicao : 0;
  return { indice, proxima: temProxima ? indice + 1 : null, progresso, mistura };
}

/** Escala do efeito Ken Burns (aproxima 1.0 → 1.08). */
export function escalaKenBurns(progresso: number): number {
  return 1 + 0.08 * Math.min(1, Math.max(0, progresso));
}
