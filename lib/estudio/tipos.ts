// Tipos do Estúdio. Seguem o contrato de docs/modulos/00-base.md
// (Firestore: empresas/{empresaId}/criacoes/{id}).

export type Formato = '1:1' | '3:4' | '4:5' | '9:16';

export type EstiloFoto = 'fundo-limpo' | 'ambientada' | 'modelo' | 'flat-lay' | 'detalhe';

export type ModeloPost = 'promocao' | 'novidade' | 'depoimento' | 'antes-depois';

export type TipoCriacao = 'foto' | 'post' | 'video' | 'slideshow' | 'legenda' | 'calendario';

export type StatusCriacao = 'gerando' | 'pronta' | 'falhou';

/** Kit da marca (vem do onboarding: Empresa.marca) + extras do Estúdio. */
export interface KitMarca {
  logoUrl: string;
  cores: { primaria: string; secundaria: string };
  /** Fontes usadas na arte. Título e texto. */
  fontes: { titulo: string; texto: string };
  /** Tom de voz: ex. "próximo e divertido", "sério e técnico". */
  tom: string;
  /** Para quem a empresa fala. */
  publico: string;
  /** Palavras/promessas proibidas (ex.: "cura", "garantido"). */
  evitar: string[];
}

export interface Criacao {
  id: string;
  empresaId: string;
  tipo: TipoCriacao;
  status: StatusCriacao;
  titulo: string;
  /** URLs (ou data URLs no modo simulado) dos arquivos gerados. */
  arquivos: string[];
  formato?: Formato;
  estilo?: EstiloFoto;
  modelo?: ModeloPost;
  /** Prompt enviado à IA (guardado para reaproveitar/auditar). */
  prompt?: string;
  legenda?: string;
  hashtags?: string[];
  /** Fotos reais de origem enviadas pela empresa. */
  origem?: string[];
  creditos: number;
  porUid: string;
  criadoEm: string; // ISO
  erro?: string;
  /** Liga ao item do calendário de conteúdo, se veio de lá. */
  pautaId?: string;
  /** Post/arte: dados para o sistema desenhar o texto em cima do fundo. */
  arte?: {
    textos: { titulo: string; subtitulo?: string; chamada?: string; autor?: string };
    fundo: string;
    fotosReais?: string[];
  };
  /** Vídeo: operação longa da IA ainda em andamento. */
  operacao?: string;
  /** Quantas variações foram pedidas (para devolução parcial). */
  pedidas?: number;
}

export interface LancamentoCredito {
  id: string;
  empresaId: string;
  tipo: 'debito' | 'devolucao' | 'recarga';
  valor: number; // sempre positivo
  saldoDepois: number;
  motivo: string;
  criacaoId?: string;
  quando: string; // ISO
}
