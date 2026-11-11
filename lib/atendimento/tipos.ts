// Tipos do Atendimento. A parte "Base" vem do contrato da sessão A (lib/tipos.ts).

import type { Agendamento as AgendamentoBase } from '@/lib/tipos'

export type {
  Papel,
  HorarioDia,
  Empresa,
  Membro,
  Contato,
  Atividade,
  Servico,
  Profissional,
  StatusAgendamento,
} from '@/lib/tipos'

/** Agendamento do contrato + quando foi criado (usado nas métricas e nos lembretes). */
export interface Agendamento extends AgendamentoBase {
  criadoEm?: string
}

/** Ids das etapas padrão do funil (lib/contatos/funil.ts). */
export const ETAPA = { novo: 'novo', emConversa: 'em-conversa', agendado: 'agendado' } as const

// ---------- Atendimento ----------
export type Autor = 'cliente' | 'ia' | 'equipe' | 'sistema'
export type TipoMensagem = 'texto' | 'audio' | 'imagem' | 'botao' | 'modelo'
export type StatusEnvio = 'enviando' | 'enviada' | 'entregue' | 'lida' | 'falhou'

export interface Mensagem {
  id: string
  conversaId: string
  de: Autor
  tipo: TipoMensagem
  texto: string
  midiaId?: string
  midiaUrl?: string
  wamid?: string
  porUid?: string
  em: string // ISO
  status?: StatusEnvio
}

export type StatusConversa = 'aberta' | 'resolvida'

export interface Conversa {
  id: string
  empresaId: string
  contatoId: string
  telefone: string
  nomeContato: string
  status: StatusConversa
  /** 'ia' = a IA responde; 'humano' = alguém da equipe assumiu e a IA fica quieta. */
  modo: 'ia' | 'humano'
  responsavelUid?: string
  precisaHumano: boolean
  motivoHumano?: string
  ultimaMensagem: { texto: string; de: Autor; em: string }
  ultimaMsgClienteId?: string
  ultimaMsgClienteEm?: string
  /** Desde quando a última mensagem do cliente espera resposta (null = respondido). */
  aguardandoDesde?: string | null
  primeiraRespostaMs?: number
  ultimaRespostaEm?: string
  iaDigitando: boolean
  naoLidas: number
  houveHumano: boolean
  avisadoEm?: string | null
  criadoEm: string
  resolvidaEm?: string
}

export interface PerguntaResposta {
  pergunta: string
  resposta: string
}

export interface MensagemRapida {
  atalho: string
  texto: string
}

export interface Treino {
  empresaId: string
  /** IA ligada no WhatsApp de verdade. Desligada = só a equipe responde. */
  ligada: boolean
  nomeAssistente: string
  tom: string
  perguntas: PerguntaResposta[]
  nuncaDizer: string[]
  quandoChamarHumano: string[]
  regrasExtras: string
  linkAvaliacao?: string
  mensagensRapidas: MensagemRapida[]
  automacoes: {
    lembreteVespera: boolean
    lembreteUmaHora: boolean
    recuperarFalta: boolean
    pedirAvaliacao: boolean
  }
  /** Avisar a equipe quando o cliente espera humano há mais de X minutos. */
  avisoHumanoMin: number
  atualizadoEm?: string
}

export interface ModelosAprovados {
  /** Nomes dos modelos (templates) aprovados na Meta, usados fora da janela de 24h. */
  lembrete?: string
  recuperacao?: string
  avaliacao?: string
  /** Modelo genérico pra retomar conversa (equipe respondendo fora da janela). */
  retomada?: string
  idioma?: string // padrão 'pt_BR'
}

export interface ConexaoWhatsApp {
  empresaId: string
  phoneNumberId: string
  wabaId: string
  tokenCifrado: string
  /** App Secret do app da Meta da empresa (cifrado), se ela usa app próprio. Sem ele vale o WHATSAPP_APP_SECRET da Atena. */
  appSecretCifrado?: string
  numeroExibicao?: string
  nomeVerificado?: string
  conectadoEm: string
  modelos: ModelosAprovados
  /** 'meta' = conectado pelo botão (Cadastro Incorporado); sem campo = manual. */
  origem?: 'manual' | 'meta'
  /** Número continua no app WhatsApp Business do celular (coexistência). */
  coexistencia?: boolean
  /** PIN de 2 etapas do número registrado pela Atena (cifrado; fica em segredos). */
  pinCifrado?: string
}

export interface ItemFila {
  id: string
  empresaId: string
  conversaId: string
  gatilhoMsgId: string
  processarApos: string // ISO
  tentativas: number
}

export interface InscricaoPush {
  uid: string
  endpoint: string
  chaves: { p256dh: string; auth: string }
}
