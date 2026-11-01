// Tipos do Coach de Vendas (sessão C).
// Seguem o contrato de docs/modulos/00-base.md: todo dado pertence a uma empresaId.
// Firestore: empresas/{empresaId}/reunioes/{id} e empresas/{empresaId}/coach/{roteiro|config}.

/** De onde veio o áudio de um pedaço. */
export type Trilha = 'vendedor' | 'cliente' | 'misto';

/** Quem falou (na trilha "misto" quem decide é a IA; nas outras, a própria trilha). */
export type Falante = 'vendedor' | 'cliente' | 'desconhecido';

/** Uma fala da transcrição, com tempo em segundos desde o início da reunião. */
export interface Fala {
  quem: Falante;
  trilha: Trilha;
  inicioSeg: number;
  fimSeg: number;
  texto: string;
}

// ---------- Roteiro ----------

export interface EtapaRoteiro {
  id: string;
  nome: string;
  objetivo: string;
  perguntasChave: string[];
}

export interface ObjecaoRoteiro {
  id: string;
  objecao: string;
  respostaIdeal: string;
}

export interface Roteiro {
  segmento: string;
  etapas: EtapaRoteiro[];
  objecoes: ObjecaoRoteiro[];
  atualizadoEm?: string;
}

// ---------- Reunião ----------

export type ModoGravacao = 'duas-trilhas' | 'so-microfone' | 'arquivo';

export type StatusReuniao = 'gravando' | 'transcrevendo' | 'analisando' | 'pronta' | 'erro';

export interface Pedaco {
  indice: number;
  trilha: Trilha;
  inicioSeg: number;
  duracaoSeg: number;
  status: 'enviado' | 'transcrito' | 'erro';
  falas: Fala[];
  /** Áudio do pedaço no Storage (pro player). */
  caminhoAudio?: string;
  mime?: string;
  erro?: string;
}

export type Resultado = 'fechou' | 'retorno' | 'pensando' | 'sem_interesse';

export type StatusEtapa = 'feita' | 'parcial' | 'nao_feita';

export interface AnaliseEtapa {
  etapaId: string;
  nome: string;
  status: StatusEtapa;
  comentario: string;
}

export interface AnaliseObjecao {
  objecao: string;
  momentoSeg: number | null;
  bemRespondida: boolean;
  comoRespondeu: string;
  comoResponderMelhor: string;
}

export interface Diagnostico {
  situacao: string;
  dores: string[];
  objetivo: string;
  decisor: string;
  orcamento: string;
  urgencia: string;
}

export interface Analise {
  resumo: string;
  resultado: Resultado;
  /** 0 a 100 */
  chanceFechar: number;
  /** 0 a 10, uma casa decimal */
  nota: number;
  etapas: AnaliseEtapa[];
  diagnostico: Diagnostico;
  objecoes: AnaliseObjecao[];
  pontosFortes: string[];
  melhorar: string[];
  proximoPasso: { acao: string; data: string | null };
  followup: string;
  /** Calculado pelas falas, não pela IA. */
  fala: { vendedorPct: number; clientePct: number };
  geradoEm: string;
  simulado?: boolean;
}

export interface Reuniao {
  id: string;
  empresaId: string;
  titulo: string;
  vendedorUid: string;
  vendedorNome: string;
  contatoId: string | null;
  contatoNome?: string;
  contatoTelefone?: string;
  modo: ModoGravacao;
  status: StatusReuniao;
  /** true quando era pra ter áudio da aba (cliente) e não veio. */
  semAudioDaAba: boolean;
  pedacos: Pedaco[];
  duracaoSeg: number;
  /** Caminho do arquivo no Storage (envio de arquivo ou áudio juntado). */
  arquivo?: {
    caminho: string;
    mime: string;
    bytes: number;
    nome: string;
    /** Duração lida no navegador (metadados do arquivo). */
    duracaoSeg?: number;
    /** Arquivo já enviado à Files API do Gemini (vale 48 h). */
    gemini?: { uri: string; mimeType: string; enviadoEm: string };
    /** Quantas janelas de 10 min já foram transcritas. */
    janelasFeitas?: number;
  };
  analise?: Analise;
  naBiblioteca: boolean;
  erro?: string;
  criadoEm: string;
  atualizadoEm: string;
}

/** Configuração do Coach por empresa. */
export interface ConfigCoach {
  /** Se true, o resultado da reunião move a etapa do contato no funil. */
  moverEtapa: boolean;
  /** Para qual etapa do funil cada resultado move (nome da etapa). */
  etapaPorResultado: Partial<Record<Resultado, string>>;
}

export const CONFIG_PADRAO: ConfigCoach = {
  moverEtapa: false,
  etapaPorResultado: {
    fechou: 'Cliente',
    retorno: 'Em conversa',
    pensando: 'Em conversa',
    sem_interesse: 'Perdido',
  },
};

/** Quem está pedindo (vem do exigirEmpresa da Base). */
export interface Sessao {
  uid: string;
  empresaId: string;
  papel: 'dono' | 'gestor' | 'atendente' | 'vendedor';
  nome?: string;
}
