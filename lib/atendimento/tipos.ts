// Tipos do Atendimento.
// A parte "Base" é cópia do contrato em docs/modulos/00-base.md. Quando o esqueleto da sessão A
// existir com os tipos oficiais, trocar estes por re-exports de lá (a junção acerta os detalhes).

// ---------- Base (contrato) ----------
export type Papel = 'dono' | 'gestor' | 'atendente' | 'vendedor'

export interface HorarioDia {
  dia: number // 0 = domingo … 6 = sábado
  abre: string // 'HH:MM'
  fecha: string // 'HH:MM'
}

export interface Empresa {
  id: string
  nome: string
  segmento: string
  fuso: string // 'America/Sao_Paulo'
  telefone: string
  endereco: string
  horarios: HorarioDia[]
  marca?: { logoUrl?: string; cores?: { primaria?: string; secundaria?: string }; tom?: string }
  plano?: { abas: ('atendimento' | 'coach' | 'estudio')[]; creditos: number }
  criadoEm: string
}

export interface Membro {
  uid: string
  email: string
  nome: string
  papel: Papel
  ativo: boolean
}

export interface Contato {
  id: string
  empresaId: string
  nome: string
  telefone: string // E.164 sem "+"
  email?: string
  origem: string
  etapa: string
  etiquetas: string[]
  responsavelUid?: string
  ultimaInteracaoEm: string
  criadoEm: string
  campos: Record<string, string>
}

export interface Atividade {
  id: string
  contatoId: string
  tipo: 'mensagem' | 'agendamento' | 'reuniao' | 'nota' | 'etapa'
  resumo: string
  quando: string
  porUid?: string
  porIA?: boolean
}

export interface Servico {
  id: string
  nome: string
  duracaoMin: number
  preco: number
  descricao: string
}

export interface Profissional {
  id: string
  nome: string
  servicosIds: string[]
  horarios: HorarioDia[]
}

export type StatusAgendamento = 'marcado' | 'confirmado' | 'compareceu' | 'faltou' | 'cancelado'

export interface Agendamento {
  id: string
  contatoId: string
  servicoId: string
  profissionalId: string
  inicio: string // ISO
  fim: string // ISO
  status: StatusAgendamento
  criadoPor: 'ia' | string // 'ia' ou uid
  lembretes: { vesperaEm?: string; umaHoraEm?: string }
  criadoEm?: string
}

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
  numeroExibicao?: string
  nomeVerificado?: string
  conectadoEm: string
  modelos: ModelosAprovados
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
