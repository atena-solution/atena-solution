import { describe, expect, it } from 'vitest'
import { RepoBanco } from '@/lib/atendimento/repo-banco'
import { BancoMemoria } from '@/lib/dados/banco'

describe('repositório do Atendimento (banco da Base)', () => {
  const novo = () => {
    const banco = new BancoMemoria()
    return { banco, repo: new RepoBanco(banco) }
  }
  it('token fica fora da empresa (segredos/) e um número não vai pra duas empresas', async () => {
    const { banco, repo } = novo()
    await repo.salvarConexao({ empresaId: 'e1', phoneNumberId: 'PN1', wabaId: 'W', tokenCifrado: 'v1:x', conectadoEm: '', modelos: {} })
    expect(await banco.obter('empresas/e1/atendimento/conexao')).not.toHaveProperty('tokenCifrado')
    expect((await repo.conexao('e1'))?.tokenCifrado).toBe('v1:x')
    expect(await repo.empresaPorPhoneNumberId('PN1')).toBe('e1')
    await expect(repo.salvarConexao({ empresaId: 'e2', phoneNumberId: 'PN1', wabaId: 'W', tokenCifrado: 'y', conectadoEm: '', modelos: {} })).rejects.toThrow(/outra empresa/)
    await repo.removerConexao('e1')
    expect(await repo.empresaPorPhoneNumberId('PN1')).toBeNull()
  })
  it('deduplica wamid por empresa', async () => {
    const { repo } = novo()
    expect(await repo.marcarWamid('e1', 'wamid.HBg=/x')).toBe(true)
    expect(await repo.marcarWamid('e1', 'wamid.HBg=/x')).toBe(false)
    expect(await repo.marcarWamid('e2', 'wamid.HBg=/x')).toBe(true)
  })
  it('não atualiza conversa de outra empresa nem aceita id malicioso', async () => {
    const { repo } = novo()
    const c = await repo.criarConversa('e1', {
      contatoId: 'ct1', telefone: '55', nomeContato: 'A', status: 'aberta', modo: 'ia', precisaHumano: false,
      ultimaMensagem: { texto: '', de: 'cliente', em: '' }, iaDigitando: false, naoLidas: 0, houveHumano: false, criadoEm: '',
    })
    await repo.atualizarConversa('e2', c.id, { status: 'resolvida' })
    expect(await repo.conversa('e2', c.id)).toBeNull()
    expect((await repo.conversa('e1', c.id))?.status).toBe('aberta')
    await expect(repo.conversa('e1', '../e2/conversas/x')).rejects.toThrow(/inválido/)
  })
  it('status da mensagem só anda pra frente', async () => {
    const { repo } = novo()
    const m = await repo.adicionarMensagem('e1', { conversaId: 'cv', de: 'ia', tipo: 'texto', texto: 'oi', em: '2026-11-01T00:00:00.000Z', wamid: 'w1', status: 'enviada' })
    await repo.atualizarStatusPorWamid('e1', 'w1', 'lida')
    await repo.atualizarStatusPorWamid('e1', 'w1', 'entregue')
    expect((await repo.mensagens('e1', 'cv', 5))[0]).toMatchObject({ id: m.id, status: 'lida' })
  })
  it('agendamento concorrente: só um ganha o horário', async () => {
    const { repo } = novo()
    const ag = { contatoId: 'c', servicoId: 's', profissionalId: 'p', inicio: '2026-11-03T13:00:00.000Z', fim: '2026-11-03T13:30:00.000Z', status: 'marcado' as const, criadoPor: 'ia', lembretes: {} }
    const r = await Promise.all([repo.criarAgendamentoSeLivre('e1', ag), repo.criarAgendamentoSeLivre('e1', { ...ag, contatoId: 'd' })])
    expect(r.filter(Boolean)).toHaveLength(1)
  })
  it('fila: um item só é pego uma vez', async () => {
    const { repo } = novo()
    const i = await repo.enfileirar({ empresaId: 'e1', conversaId: 'cv', gatilhoMsgId: 'm', processarApos: '2026-01-01' })
    expect(await repo.pegarItem(i.id)).toBe(true)
    expect(await repo.pegarItem(i.id)).toBe(false)
    await repo.concluirItem(i.id)
    expect(await repo.filaVencida('9999', 10)).toHaveLength(0)
  })
})
