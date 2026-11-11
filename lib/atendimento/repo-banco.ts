// Repositório do Atendimento em cima do `Banco` da Base (lib/dados): memória no modo simulado, Firestore em produção.
//
// Onde fica cada coisa (Firestore):
//   whatsappNumeros/{phoneNumberId}                       → { empresaId }  (roteamento do webhook; só servidor)
//   segredos/whatsapp_{empresaId}                         → { tokenCifrado } (sem regra = ninguém lê do navegador)
//   filaAtendimento/{id}, filaAtendimentoPegos/{id}       → fila simples de respostas da IA
//   empresas/{id}/atendimento/conexao | treino            → configuração (sem token)
//   empresas/{id}/conversas/{cv_<contatoId>}              → conversa (tempo real na caixa de entrada)
//   empresas/{id}/conversas/{cid}/mensagens/{mid}         → mensagens
//   empresas/{id}/atendimento_recebidos/{hash(wamid)}     → deduplicação
//   empresas/{id}/atendimento_enviados/{hash(wamid)}      → wamid → mensagem (status entregue/lida)
//   empresas/{id}/atendimento_telefones/{telefone}        → índice telefone → contato
//   empresas/{id}/atendimento_automacoes/{chave}          → lembretes já enviados
//   empresas/{id}/atendimento_push/{hash(endpoint)}       → inscrições de web push
//   contatos, atividades, agendamentos, servicos, profissionais, membros → coleções da Base

import { createHash } from 'node:crypto'
import type { Banco } from '@/lib/dados/banco'
import { juntar } from '@/lib/dados/banco'
import { novoId } from '@/lib/dados/empresa'
import { temConflito } from '@/lib/agenda/horarios'
import { caminhoTravaAgenda, travaLocal } from '@/lib/agenda/trava'
import { treinoPadrao, type RepoAtendimento } from './repositorio'
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

/** Operações que precisam ser atômicas (o Firestore tem implementação própria). */
export interface Atomico {
  /** Cria o documento só se ele não existir. true = criou. */
  criarSeNaoExiste(caminho: string, dados: object): Promise<boolean>
  /** Roda `fn` com exclusividade sobre a trava. */
  comTrava<T>(caminhoTrava: string, fn: () => Promise<T>): Promise<T>
}

/** Versão de um processo só (memória / testes). */
export function atomicoLocal(b: Banco): Atomico {
  return {
    async criarSeNaoExiste(caminho, dados) {
      if (await b.obter(caminho)) return false
      await b.gravar(caminho, dados)
      return true
    },
    // a mesma fila da agenda da Base: IA e equipe esperam juntas
    comTrava: (caminho, fn) => travaLocal.comTrava(caminho, fn),
  }
}

let contador = 0
/** Id que ordena pela hora da mensagem e, no empate, pela ordem de gravação. */
function idMensagem(em: string) {
  contador = (contador + 1) % 1_000_000
  const t = (Date.parse(em) || Date.now()).toString(36).padStart(9, '0')
  return `m${t}${contador.toString(36).padStart(4, '0')}${Math.random().toString(36).slice(2, 6)}`
}

const h = (s: string) => createHash('sha256').update(s).digest('hex').slice(0, 40)
const seguro = (s: string) => s.replace(/[^A-Za-z0-9_.@+-]/g, '_').slice(0, 200)

export class RepoBanco implements RepoAtendimento {
  constructor(
    private b: Banco,
    private at: Atomico = atomicoLocal(b),
  ) {}

  private e(empresaId: string, ...resto: string[]) {
    return juntar('empresas', empresaId, ...resto)
  }

  // ----- roteamento -----
  async empresaPorPhoneNumberId(phoneNumberId: string) {
    const d = await this.b.obter<{ empresaId: string }>(juntar('whatsappNumeros', seguro(phoneNumberId)))
    return d?.empresaId ?? null
  }
  async empresasConectadas() {
    const lista = await this.b.listar<{ empresaId: string }>('whatsappNumeros')
    return [...new Set(lista.map((x) => x.empresaId))]
  }

  // ----- empresa e configuração -----
  async empresa(id: string) {
    return this.b.obter<Empresa>(this.e(id))
  }
  async membros(id: string) {
    return this.b.listar<Membro>(this.e(id, 'membros'))
  }
  async conexao(id: string) {
    const pub = await this.b.obter<Omit<ConexaoWhatsApp, 'tokenCifrado'>>(this.e(id, 'atendimento', 'conexao'))
    if (!pub) return null
    const seg = await this.b.obter<{ tokenCifrado: string; appSecretCifrado?: string; pinCifrado?: string }>(juntar('segredos', `whatsapp_${id}`))
    return { ...pub, tokenCifrado: seg?.tokenCifrado ?? '', ...(seg?.appSecretCifrado ? { appSecretCifrado: seg.appSecretCifrado } : {}), ...(seg?.pinCifrado ? { pinCifrado: seg.pinCifrado } : {}) }
  }
  async salvarConexao(c: ConexaoWhatsApp) {
    const indice = juntar('whatsappNumeros', seguro(c.phoneNumberId))
    const dono = await this.b.obter<{ empresaId: string }>(indice)
    if (dono && dono.empresaId !== c.empresaId) throw new Error('Esse número já está conectado em outra empresa.')
    const anterior = await this.conexao(c.empresaId)
    if (anterior && anterior.phoneNumberId !== c.phoneNumberId) await this.b.apagar(juntar('whatsappNumeros', seguro(anterior.phoneNumberId)))
    const { tokenCifrado, appSecretCifrado, pinCifrado, ...pub } = c
    await this.b.gravar(juntar('segredos', `whatsapp_${c.empresaId}`), { tokenCifrado, ...(appSecretCifrado ? { appSecretCifrado } : {}), ...(pinCifrado ? { pinCifrado } : {}) })
    await this.b.gravar(this.e(c.empresaId, 'atendimento', 'conexao'), pub)
    await this.b.gravar(indice, { empresaId: c.empresaId })
  }
  async removerConexao(id: string) {
    const c = await this.conexao(id)
    if (c) await this.b.apagar(juntar('whatsappNumeros', seguro(c.phoneNumberId)))
    await this.b.apagar(this.e(id, 'atendimento', 'conexao'))
    await this.b.apagar(juntar('segredos', `whatsapp_${id}`))
  }
  async treino(id: string) {
    const t = await this.b.obter<Treino>(this.e(id, 'atendimento', 'treino'))
    const padrao = treinoPadrao(id)
    return t ? { ...padrao, ...t, automacoes: { ...padrao.automacoes, ...t.automacoes }, empresaId: id } : padrao
  }
  async salvarTreino(t: Treino) {
    await this.b.gravar(this.e(t.empresaId, 'atendimento', 'treino'), t)
  }
  async servicos(id: string) {
    return this.b.listar<Servico>(this.e(id, 'servicos'))
  }
  async profissionais(id: string) {
    return this.b.listar<Profissional>(this.e(id, 'profissionais'))
  }

  // ----- agenda -----
  private async todosAgendamentos(id: string) {
    return this.b.listar<Agendamento>(this.e(id, 'agendamentos'))
  }
  async agendamentos(id: string, de: string, ate: string) {
    return (await this.todosAgendamentos(id)).filter((a) => a.inicio >= de && a.inicio < ate)
  }
  async agendamentosDoContato(id: string, contatoId: string) {
    return (await this.todosAgendamentos(id)).filter((a) => a.contatoId === contatoId)
  }
  async agendamento(id: string, agId: string) {
    return this.b.obter<Agendamento>(this.e(id, 'agendamentos', agId))
  }
  async criarAgendamentoSeLivre(id: string, ag: Omit<Agendamento, 'id'>) {
    // trava por profissional (a mesma da Agenda) + a regra única de "horário ocupado" (temConflito)
    return this.at.comTrava(caminhoTravaAgenda(id, ag.profissionalId), async () => {
      if (temConflito(await this.todosAgendamentos(id), ag.profissionalId, ag.inicio, ag.fim)) return null
      const novo: Agendamento = { ...ag, id: novoId('ag-') }
      await this.b.gravar(this.e(id, 'agendamentos', novo.id), novo)
      return novo
    })
  }
  async remarcarSeLivre(id: string, agId: string, patch: Pick<Agendamento, 'inicio' | 'fim' | 'profissionalId'> & Partial<Agendamento>) {
    return this.at.comTrava(caminhoTravaAgenda(id, patch.profissionalId), async () => {
      const atual = await this.agendamento(id, agId)
      if (!atual) return false
      if (temConflito(await this.todosAgendamentos(id), patch.profissionalId, patch.inicio, patch.fim, agId)) return false
      await this.b.mesclar(this.e(id, 'agendamentos', agId), { ...patch, id: agId })
      return true
    })
  }
  async atualizarAgendamento(id: string, agId: string, patch: Partial<Agendamento>) {
    if (!(await this.agendamento(id, agId))) return
    await this.b.mesclar(this.e(id, 'agendamentos', agId), { ...patch, id: agId })
  }

  // ----- contatos -----
  async contato(id: string, cId: string) {
    return this.b.obter<Contato>(this.e(id, 'contatos', cId))
  }
  async contatoPorTelefone(id: string, tel: string) {
    const indice = await this.b.obter<{ contatoId: string }>(this.e(id, 'atendimento_telefones', seguro(tel)))
    if (indice) {
      const c = await this.contato(id, indice.contatoId)
      if (c && c.telefone === tel) return c
    }
    // contato criado pela Base (Contatos/CSV): procura e já indexa
    const achado = (await this.b.listar<Contato>(this.e(id, 'contatos'))).find((c) => c.telefone === tel) ?? null
    if (achado) await this.b.gravar(this.e(id, 'atendimento_telefones', seguro(tel)), { contatoId: achado.id })
    return achado
  }
  async criarContato(id: string, c: Omit<Contato, 'id' | 'empresaId'>) {
    const novo: Contato = { ...c, id: novoId('ct-'), empresaId: id }
    await this.b.gravar(this.e(id, 'contatos', novo.id), novo)
    await this.b.gravar(this.e(id, 'atendimento_telefones', seguro(novo.telefone)), { contatoId: novo.id })
    return novo
  }
  async atualizarContato(id: string, cId: string, patch: Partial<Contato>) {
    if (!(await this.contato(id, cId))) return
    await this.b.mesclar(this.e(id, 'contatos', cId), { ...patch, id: cId, empresaId: id })
  }
  async registrarAtividade(id: string, a: Omit<Atividade, 'id'>) {
    const nova: Atividade = { ...a, id: novoId('at-') }
    await this.b.gravar(this.e(id, 'atividades', nova.id), nova)
  }
  async atividades(id: string, contatoId: string, limite: number) {
    return (await this.b.listar<Atividade>(this.e(id, 'atividades')))
      .filter((a) => a.contatoId === contatoId)
      .sort((a, b) => a.quando.localeCompare(b.quando))
      .slice(-limite)
  }

  async marcarWamid(id: string, wamid: string) {
    return this.at.criarSeNaoExiste(this.e(id, 'atendimento_recebidos', h(wamid)), { em: new Date().toISOString() })
  }

  // ----- conversas -----
  async conversa(id: string, cId: string) {
    return this.b.obter<Conversa>(this.e(id, 'conversas', cId))
  }
  async conversaDoContato(id: string, contatoId: string) {
    return this.conversa(id, `cv_${seguro(contatoId)}`)
  }
  async criarConversa(id: string, c: Omit<Conversa, 'id' | 'empresaId'>) {
    const nova: Conversa = { ...c, id: `cv_${seguro(c.contatoId)}`, empresaId: id }
    await this.b.gravar(this.e(id, 'conversas', nova.id), nova)
    return nova
  }
  async atualizarConversa(id: string, cId: string, patch: Partial<Conversa>) {
    if (!(await this.conversa(id, cId))) return
    await this.b.mesclar(this.e(id, 'conversas', cId), { ...patch, id: cId, empresaId: id })
  }
  async listarConversas(id: string, limite = 200) {
    return (await this.b.listar<Conversa>(this.e(id, 'conversas')))
      .filter((c) => c.ultimaMensagem && c.telefone) // ignora rascunhos antigos
      .sort((a, b) => b.ultimaMensagem.em.localeCompare(a.ultimaMensagem.em))
      .slice(0, limite)
  }
  async adicionarMensagem(id: string, m: Omit<Mensagem, 'id'>) {
    const nova: Mensagem = { ...m, id: idMensagem(m.em) }
    await this.b.gravar(this.e(id, 'conversas', m.conversaId, 'mensagens', nova.id), nova)
    if (m.wamid && m.de !== 'cliente')
      await this.b.gravar(this.e(id, 'atendimento_enviados', h(m.wamid)), { conversaId: m.conversaId, mensagemId: nova.id })
    return nova
  }
  async atualizarStatusPorWamid(id: string, wamid: string, status: Mensagem['status']) {
    const ref = await this.b.obter<{ conversaId: string; mensagemId: string }>(this.e(id, 'atendimento_enviados', h(wamid)))
    if (!ref) return
    const caminho = this.e(id, 'conversas', ref.conversaId, 'mensagens', ref.mensagemId)
    const atual = await this.b.obter<Mensagem>(caminho)
    if (!atual) return
    // status só anda pra frente (a Meta pode entregar fora de ordem)
    const ordem = ['enviando', 'enviada', 'entregue', 'lida']
    if (status !== 'falhou' && ordem.indexOf(status ?? '') <= ordem.indexOf(atual.status ?? '')) return
    await this.b.mesclar(caminho, { status })
  }
  async mensagens(id: string, conversaId: string, limite: number) {
    return (await this.b.listar<Mensagem>(this.e(id, 'conversas', conversaId, 'mensagens')))
      .sort((a, b) => a.em.localeCompare(b.em) || a.id.localeCompare(b.id))
      .slice(-limite)
  }

  // ----- fila -----
  async enfileirar(item: Omit<ItemFila, 'id' | 'tentativas'>) {
    const novo: ItemFila = { ...item, id: novoId('f'), tentativas: 0 }
    await this.b.gravar(juntar('filaAtendimento', novo.id), novo)
    return novo
  }
  async filaVencida(agoraISO: string, limite: number) {
    return (await this.b.listar<ItemFila>('filaAtendimento'))
      .filter((i) => i.processarApos <= agoraISO)
      .sort((a, b) => a.processarApos.localeCompare(b.processarApos))
      .slice(0, limite)
  }
  async itemFila(id: string) {
    return this.b.obter<ItemFila>(juntar('filaAtendimento', id))
  }
  async pegarItem(id: string) {
    if (!(await this.itemFila(id))) return false
    return this.at.criarSeNaoExiste(juntar('filaAtendimentoPegos', id), { em: new Date().toISOString() })
  }
  async concluirItem(id: string) {
    await this.b.apagar(juntar('filaAtendimento', id))
    await this.b.apagar(juntar('filaAtendimentoPegos', id))
  }

  // ----- automações -----
  private chave(id: string, chave: string) {
    return this.e(id, 'atendimento_automacoes', seguro(chave))
  }
  async automacaoFeita(id: string, chave: string) {
    return !!(await this.b.obter(this.chave(id, chave)))
  }
  async automacoesFeitas(id: string, chaves: string[]) {
    const feitas = new Set((await this.b.listar<{ chave: string }>(this.e(id, 'atendimento_automacoes'))).map((x) => x.chave))
    return new Set(chaves.filter((c) => feitas.has(c)))
  }
  async registrarAutomacao(id: string, chave: string, detalhe: Record<string, unknown>) {
    await this.b.gravar(this.chave(id, chave), { ...detalhe, chave })
  }

  // ----- push -----
  async inscricoesPush(id: string, uids: string[]) {
    return (await this.b.listar<InscricaoPush>(this.e(id, 'atendimento_push'))).filter((p) => uids.includes(p.uid))
  }
  async salvarInscricaoPush(id: string, i: InscricaoPush) {
    await this.b.gravar(this.e(id, 'atendimento_push', h(i.endpoint)), i)
  }
}
