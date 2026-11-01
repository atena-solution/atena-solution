// Acesso a dados do Atendimento. TODA função recebe empresaId: nada atravessa empresas.
// Duas implementações: memória (testes e SIMULAR=1) e Firestore (produção).

import type {
  Agendamento,
  Atividade,
  ConexaoWhatsApp,
  Contato,
  Conversa,
  Empresa,
  InscricaoPush,
  ItemFila,
  Membro,
  Mensagem,
  Profissional,
  Servico,
  Treino,
} from './tipos'

export interface RepoAtendimento {
  // roteamento (índice global phone_number_id → empresa; não contém dado da empresa)
  empresaPorPhoneNumberId(phoneNumberId: string): Promise<string | null>
  empresasConectadas(): Promise<string[]>

  empresa(empresaId: string): Promise<Empresa | null>
  membros(empresaId: string): Promise<Membro[]>
  conexao(empresaId: string): Promise<ConexaoWhatsApp | null>
  salvarConexao(c: ConexaoWhatsApp): Promise<void>
  removerConexao(empresaId: string): Promise<void>
  treino(empresaId: string): Promise<Treino>
  salvarTreino(t: Treino): Promise<void>
  servicos(empresaId: string): Promise<Servico[]>
  profissionais(empresaId: string): Promise<Profissional[]>

  /** Agendamentos com início no intervalo [de, ate). */
  agendamentos(empresaId: string, deISO: string, ateISO: string): Promise<Agendamento[]>
  agendamentosDoContato(empresaId: string, contatoId: string): Promise<Agendamento[]>
  agendamento(empresaId: string, id: string): Promise<Agendamento | null>
  /**
   * Cria o agendamento só se o profissional ainda estiver livre (transação no Firestore).
   * Devolve null se alguém ocupou o horário no meio do caminho.
   */
  criarAgendamentoSeLivre(empresaId: string, ag: Omit<Agendamento, 'id'>): Promise<Agendamento | null>
  atualizarAgendamento(empresaId: string, id: string, patch: Partial<Agendamento>): Promise<void>

  contato(empresaId: string, id: string): Promise<Contato | null>
  contatoPorTelefone(empresaId: string, telefone: string): Promise<Contato | null>
  criarContato(empresaId: string, c: Omit<Contato, 'id' | 'empresaId'>): Promise<Contato>
  atualizarContato(empresaId: string, id: string, patch: Partial<Contato>): Promise<void>
  registrarAtividade(empresaId: string, a: Omit<Atividade, 'id'>): Promise<void>
  atividades(empresaId: string, contatoId: string, limite: number): Promise<Atividade[]>

  /** true se o wamid é novo (e marca como visto). Atômico. */
  marcarWamid(empresaId: string, wamid: string): Promise<boolean>

  conversa(empresaId: string, id: string): Promise<Conversa | null>
  conversaDoContato(empresaId: string, contatoId: string): Promise<Conversa | null>
  criarConversa(empresaId: string, c: Omit<Conversa, 'id' | 'empresaId'>): Promise<Conversa>
  atualizarConversa(empresaId: string, id: string, patch: Partial<Conversa>): Promise<void>
  listarConversas(empresaId: string, limite?: number): Promise<Conversa[]>
  adicionarMensagem(empresaId: string, m: Omit<Mensagem, 'id'>): Promise<Mensagem>
  atualizarStatusPorWamid(empresaId: string, wamid: string, status: Mensagem['status']): Promise<void>
  /** Últimas `limite` mensagens, em ordem cronológica. */
  mensagens(empresaId: string, conversaId: string, limite: number): Promise<Mensagem[]>

  enfileirar(item: Omit<ItemFila, 'id' | 'tentativas'>): Promise<ItemFila>
  filaVencida(agoraISO: string, limite: number): Promise<ItemFila[]>
  itemFila(id: string): Promise<ItemFila | null>
  /** Pega o item pra si (evita processar duas vezes). false se outro já pegou. */
  pegarItem(id: string): Promise<boolean>
  concluirItem(id: string): Promise<void>

  automacaoFeita(empresaId: string, chave: string): Promise<boolean>
  automacoesFeitas(empresaId: string, chaves: string[]): Promise<Set<string>>
  registrarAutomacao(empresaId: string, chave: string, detalhe: Record<string, unknown>): Promise<void>

  inscricoesPush(empresaId: string, uids: string[]): Promise<InscricaoPush[]>
  salvarInscricaoPush(empresaId: string, i: InscricaoPush): Promise<void>
}

export function treinoPadrao(empresaId: string): Treino {
  return {
    empresaId,
    ligada: false,
    nomeAssistente: 'Atena',
    tom: 'Simpático, direto e profissional. Trata o cliente por "você".',
    perguntas: [],
    nuncaDizer: [],
    quandoChamarHumano: [],
    regrasExtras: '',
    linkAvaliacao: '',
    mensagensRapidas: [
      { atalho: 'oi', texto: 'Oi! Tudo bem? Como posso te ajudar?' },
      { atalho: 'end', texto: 'Nosso endereço é {endereco}.' },
      { atalho: 'obg', texto: 'Obrigado pelo contato! Qualquer coisa é só chamar 😊' },
    ],
    automacoes: { lembreteVespera: true, lembreteUmaHora: true, recuperarFalta: true, pedirAvaliacao: false },
    avisoHumanoMin: 5,
  }
}
