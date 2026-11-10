/**
 * Contrato de dados da Atena (ver docs/modulos/00-base.md).
 * TODO dado pertence a uma empresa: no Firestore fica em empresas/{empresaId}/<colecao>/{id}.
 * Datas são strings ISO 8601 (UTC) para trafegar igual no cliente, no servidor e no Firestore.
 */

export type Papel = 'dono' | 'gestor' | 'atendente' | 'vendedor';
export const PAPEIS: Papel[] = ['dono', 'gestor', 'atendente', 'vendedor'];

export type AbaContratavel = 'atendimento' | 'coach' | 'estudio';

/** Horário de funcionamento de um dia da semana (0 = domingo … 6 = sábado). */
export interface HorarioDia {
  dia: number;
  abre: string; // 'HH:MM'
  fecha: string; // 'HH:MM'
}

export interface Marca {
  logoUrl: string;
  cores: { primaria: string; secundaria: string };
  tom: string; // ex.: "acolhedor e direto"
}

export interface Empresa {
  id: string;
  nome: string;
  segmento: string;
  fuso: 'America/Sao_Paulo' | string;
  telefone: string;
  endereco: string;
  horarios: HorarioDia[];
  marca: Marca;
  plano: { abas: AbaContratavel[]; creditos: number };
  /** Etapas do funil (configuráveis). */
  etapas?: EtapaFunil[];
  /** true quando o onboarding foi concluído. */
  onboardingConcluido?: boolean;
  /** Passos do onboarding guiado (lib/planos/onboarding.ts → EstadoOnboarding). */
  onboarding?: { feitos: string[]; pulados: string[]; atualizadoEm?: string };
  criadoEm: string;
}

export interface Membro {
  uid: string;
  email: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
}

/** Convite pendente para entrar na equipe (empresas/{id}/convites/{email}). */
export interface Convite {
  email: string;
  papel: Papel;
  convidadoPor: string;
  criadoEm: string;
}

export interface EtapaFunil {
  id: string;
  nome: string;
  cor?: string;
}

export interface Contato {
  id: string;
  empresaId: string;
  nome: string;
  /** E.164 sem o "+", ex.: 5511999998888 */
  telefone: string;
  email?: string;
  origem: string;
  etapa: string; // id da EtapaFunil
  etiquetas: string[];
  responsavelUid?: string;
  ultimaInteracaoEm: string;
  criadoEm: string;
  campos: Record<string, string>;
}

export type TipoAtividade = 'mensagem' | 'agendamento' | 'reuniao' | 'nota' | 'etapa';

export interface Atividade {
  id: string;
  contatoId: string;
  tipo: TipoAtividade;
  resumo: string;
  quando: string;
  porUid?: string;
  porIA?: boolean;
}

export interface Servico {
  id: string;
  nome: string;
  duracaoMin: number;
  preco: number; // em reais
  descricao: string;
}

export interface Profissional {
  id: string;
  nome: string;
  servicosIds: string[];
  horarios: HorarioDia[];
}

export type StatusAgendamento = 'marcado' | 'confirmado' | 'compareceu' | 'faltou' | 'cancelado';
export const STATUS_AGENDAMENTO: StatusAgendamento[] = ['marcado', 'confirmado', 'compareceu', 'faltou', 'cancelado'];

export interface Agendamento {
  id: string;
  contatoId: string;
  servicoId: string;
  profissionalId: string;
  inicio: string; // ISO
  fim: string; // ISO
  status: StatusAgendamento;
  criadoPor: 'ia' | string; // 'ia' ou uid
  lembretes: { vesperaEm?: string; umaHoraEm?: string };
  observacao?: string;
}

/** Subcoleções de empresas/{empresaId}. */
export const COLECOES = [
  'membros',
  'convites',
  'contatos',
  'atividades',
  'servicos',
  'profissionais',
  'agendamentos',
  'conversas',
  'reunioes',
  'criacoes',
] as const;
export type Colecao = (typeof COLECOES)[number];

/** Sessão do usuário logado, resolvida no servidor. */
export interface Sessao {
  uid: string;
  email: string;
  empresaId: string;
  papel: Papel;
}
