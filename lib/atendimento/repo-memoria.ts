// Repositório em memória: usado nos testes e no modo SIMULAR=1.
// Cada empresa tem o próprio "balde"; ids de outra empresa simplesmente não existem aqui dentro.

import { randomUUID } from 'node:crypto'
import { ocupa, cruza } from './horarios'
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

interface Balde {
  empresa: Empresa
  membros: Membro[]
  conexao: ConexaoWhatsApp | null
  treino: Treino
  servicos: Servico[]
  profissionais: Profissional[]
  agendamentos: Map<string, Agendamento>
  contatos: Map<string, Contato>
  atividades: Atividade[]
  wamids: Set<string>
  conversas: Map<string, Conversa>
  mensagens: Map<string, Mensagem[]>
  automacoes: Map<string, Record<string, unknown>>
  push: InscricaoPush[]
}

const copia = <T>(x: T): T => structuredClone(x)

export class RepoMemoria implements RepoAtendimento {
  baldes = new Map<string, Balde>()
  numeros = new Map<string, string>()
  fila = new Map<string, ItemFila & { pego?: boolean }>()

  adicionarEmpresa(p: {
    empresa: Empresa
    membros?: Membro[]
    servicos?: Servico[]
    profissionais?: Profissional[]
    treino?: Treino
    conexao?: ConexaoWhatsApp
  }) {
    this.baldes.set(p.empresa.id, {
      empresa: p.empresa,
      membros: p.membros ?? [],
      conexao: p.conexao ?? null,
      treino: p.treino ?? treinoPadrao(p.empresa.id),
      servicos: p.servicos ?? [],
      profissionais: p.profissionais ?? [],
      agendamentos: new Map(),
      contatos: new Map(),
      atividades: [],
      wamids: new Set(),
      conversas: new Map(),
      mensagens: new Map(),
      automacoes: new Map(),
      push: [],
    })
    if (p.conexao) this.numeros.set(p.conexao.phoneNumberId, p.empresa.id)
  }

  private b(empresaId: string): Balde {
    const b = this.baldes.get(empresaId)
    if (!b) throw new Error(`Empresa ${empresaId} não existe`)
    return b
  }

  async empresaPorPhoneNumberId(id: string) {
    return this.numeros.get(id) ?? null
  }
  async empresasConectadas() {
    return [...this.baldes.values()].filter((b) => b.conexao).map((b) => b.empresa.id)
  }
  async empresa(id: string) {
    return this.baldes.has(id) ? copia(this.b(id).empresa) : null
  }
  async membros(id: string) {
    return copia(this.b(id).membros)
  }
  async conexao(id: string) {
    return copia(this.baldes.get(id)?.conexao ?? null)
  }
  async salvarConexao(c: ConexaoWhatsApp) {
    const b = this.b(c.empresaId)
    // um número só pode pertencer a uma empresa
    const dono = this.numeros.get(c.phoneNumberId)
    if (dono && dono !== c.empresaId) throw new Error('Esse número já está conectado em outra empresa.')
    if (b.conexao) this.numeros.delete(b.conexao.phoneNumberId)
    b.conexao = copia(c)
    this.numeros.set(c.phoneNumberId, c.empresaId)
  }
  async removerConexao(id: string) {
    const b = this.b(id)
    if (b.conexao) this.numeros.delete(b.conexao.phoneNumberId)
    b.conexao = null
  }
  async treino(id: string) {
    return copia(this.b(id).treino)
  }
  async salvarTreino(t: Treino) {
    this.b(t.empresaId).treino = copia(t)
  }
  async servicos(id: string) {
    return copia(this.b(id).servicos)
  }
  async profissionais(id: string) {
    return copia(this.b(id).profissionais)
  }

  async agendamentos(id: string, de: string, ate: string) {
    return copia([...this.b(id).agendamentos.values()].filter((a) => a.inicio >= de && a.inicio < ate))
  }
  async agendamentosDoContato(id: string, contatoId: string) {
    return copia([...this.b(id).agendamentos.values()].filter((a) => a.contatoId === contatoId))
  }
  async agendamento(id: string, agId: string) {
    return copia(this.b(id).agendamentos.get(agId) ?? null)
  }
  async criarAgendamentoSeLivre(id: string, ag: Omit<Agendamento, 'id'>) {
    const b = this.b(id)
    const i = Date.parse(ag.inicio)
    const f = Date.parse(ag.fim)
    const choca = [...b.agendamentos.values()].some(
      (x) => x.profissionalId === ag.profissionalId && ocupa(x) && cruza(i, f, Date.parse(x.inicio), Date.parse(x.fim)),
    )
    if (choca) return null
    const novo = { ...copia(ag), id: randomUUID() }
    b.agendamentos.set(novo.id, novo)
    return copia(novo)
  }
  async atualizarAgendamento(id: string, agId: string, patch: Partial<Agendamento>) {
    const b = this.b(id)
    const a = b.agendamentos.get(agId)
    if (a) b.agendamentos.set(agId, { ...a, ...copia(patch), id: agId })
  }

  async contato(id: string, cId: string) {
    return copia(this.b(id).contatos.get(cId) ?? null)
  }
  async contatoPorTelefone(id: string, tel: string) {
    return copia([...this.b(id).contatos.values()].find((c) => c.telefone === tel) ?? null)
  }
  async criarContato(id: string, c: Omit<Contato, 'id' | 'empresaId'>) {
    const novo: Contato = { ...copia(c), id: randomUUID(), empresaId: id }
    this.b(id).contatos.set(novo.id, novo)
    return copia(novo)
  }
  async atualizarContato(id: string, cId: string, patch: Partial<Contato>) {
    const b = this.b(id)
    const c = b.contatos.get(cId)
    if (c) b.contatos.set(cId, { ...c, ...copia(patch), id: cId, empresaId: id })
  }
  async registrarAtividade(id: string, a: Omit<Atividade, 'id'>) {
    this.b(id).atividades.push({ ...copia(a), id: randomUUID() })
  }
  async atividades(id: string, contatoId: string, limite: number) {
    return copia(this.b(id).atividades.filter((a) => a.contatoId === contatoId).slice(-limite))
  }

  async marcarWamid(id: string, wamid: string) {
    const b = this.b(id)
    if (b.wamids.has(wamid)) return false
    b.wamids.add(wamid)
    return true
  }

  async conversa(id: string, cId: string) {
    return copia(this.b(id).conversas.get(cId) ?? null)
  }
  async conversaDoContato(id: string, contatoId: string) {
    return copia([...this.b(id).conversas.values()].find((c) => c.contatoId === contatoId) ?? null)
  }
  async criarConversa(id: string, c: Omit<Conversa, 'id' | 'empresaId'>) {
    const nova: Conversa = { ...copia(c), id: randomUUID(), empresaId: id }
    this.b(id).conversas.set(nova.id, nova)
    return copia(nova)
  }
  async atualizarConversa(id: string, cId: string, patch: Partial<Conversa>) {
    const b = this.b(id)
    const c = b.conversas.get(cId)
    if (c) b.conversas.set(cId, { ...c, ...copia(patch), id: cId, empresaId: id })
  }
  async listarConversas(id: string, limite = 200) {
    return copia(
      [...this.b(id).conversas.values()].sort((a, b) => b.ultimaMensagem.em.localeCompare(a.ultimaMensagem.em)).slice(0, limite),
    )
  }
  async adicionarMensagem(id: string, m: Omit<Mensagem, 'id'>) {
    const b = this.b(id)
    const nova: Mensagem = { ...copia(m), id: randomUUID() }
    const lista = b.mensagens.get(m.conversaId) ?? []
    lista.push(nova)
    b.mensagens.set(m.conversaId, lista)
    return copia(nova)
  }
  async atualizarStatusPorWamid(id: string, wamid: string, status: Mensagem['status']) {
    for (const lista of this.b(id).mensagens.values()) for (const m of lista) if (m.wamid === wamid) m.status = status
  }
  async mensagens(id: string, conversaId: string, limite: number) {
    return copia((this.b(id).mensagens.get(conversaId) ?? []).slice(-limite))
  }

  async enfileirar(item: Omit<ItemFila, 'id' | 'tentativas'>) {
    const novo = { ...item, id: randomUUID(), tentativas: 0 }
    this.fila.set(novo.id, novo)
    return copia(novo)
  }
  async filaVencida(agoraISO: string, limite: number) {
    return copia([...this.fila.values()].filter((i) => !i.pego && i.processarApos <= agoraISO).slice(0, limite))
  }
  async itemFila(id: string) {
    const i = this.fila.get(id)
    if (!i) return null
    const { pego: _pego, ...resto } = i
    return copia(resto)
  }
  async pegarItem(id: string) {
    const i = this.fila.get(id)
    if (!i || i.pego) return false
    i.pego = true
    i.tentativas++
    return true
  }
  async concluirItem(id: string) {
    this.fila.delete(id)
  }

  async automacaoFeita(id: string, chave: string) {
    return this.b(id).automacoes.has(chave)
  }
  async automacoesFeitas(id: string, chaves: string[]) {
    const b = this.b(id)
    return new Set(chaves.filter((c) => b.automacoes.has(c)))
  }
  async registrarAutomacao(id: string, chave: string, detalhe: Record<string, unknown>) {
    this.b(id).automacoes.set(chave, copia(detalhe))
  }

  async inscricoesPush(id: string, uids: string[]) {
    return copia(this.b(id).push.filter((p) => uids.includes(p.uid)))
  }
  async salvarInscricaoPush(id: string, i: InscricaoPush) {
    const b = this.b(id)
    b.push = b.push.filter((p) => p.endpoint !== i.endpoint).concat(copia(i))
  }
}
