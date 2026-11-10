// Monta um ambiente de teste com 2 empresas, IA roteirizada e canal falso.
import { RepoBanco } from '@/lib/atendimento/repo-banco'
import { BancoMemoria, juntar } from '@/lib/dados/banco'
import type { Deps, CanalWhatsApp } from '@/lib/atendimento/processar'
import type { ClienteIA } from '@/lib/integracoes/claude'
import type { ConteudoEnvio } from '@/lib/integracoes/whatsapp'
import { ana, corte, barba, empresa, joao, treino } from './fixtures'

export interface Enviada { phoneNumberId: string; para: string; conteudo: ConteudoEnvio }

export async function ambiente(ia: ClienteIA, agoraInicial = new Date('2026-11-02T13:00:00Z')) {
  const banco = new BancoMemoria()
  const repo = new RepoBanco(banco)
  for (const [id, pnid, nome] of [['e1', 'PN1', 'Barbearia Topetes'], ['e2', 'PN2', 'Clínica Mira Luz']] as const) {
    await banco.gravar(juntar('empresas', id), empresa(id, nome))
    for (const s of [corte, barba]) await banco.gravar(juntar('empresas', id, 'servicos', s.id), s)
    for (const p of [joao, ana]) await banco.gravar(juntar('empresas', id, 'profissionais', p.id), p)
    await banco.gravar(juntar('empresas', id, 'membros', `dono-${id}`), { uid: `dono-${id}`, email: '', nome: 'Dono', papel: 'dono', ativo: true })
    await repo.salvarTreino(treino(id))
    await repo.salvarConexao({ empresaId: id, phoneNumberId: pnid, wabaId: 'W' + id, tokenCifrado: `tok-${id}`, conectadoEm: '', modelos: { lembrete: 'lembrete', retomada: 'retomada' } })
  }
  const enviadas: Enviada[] = []
  let agora = agoraInicial
  const canal: CanalWhatsApp = {
    async enviar(cred, para, conteudo) {
      enviadas.push({ phoneNumberId: cred.phoneNumberId, para, conteudo })
      return { ok: true, wamid: `wamid.out${enviadas.length}` }
    },
    async marcarLidaEDigitando() {},
  }
  const deps: Deps = { repo, ia, canal, decifrar: (x) => x.replace('tok-', 'TOKEN-'), agora: () => agora }
  return {
    repo, banco, deps, enviadas,
    avancar(ms: number) { agora = new Date(agora.getTime() + ms) },
    get agora() { return agora },
  }
}

export const textos = (e: Enviada[]) => e.map((x) => (x.conteudo.tipo === 'texto' ? x.conteudo.texto : `[${x.conteudo.tipo}]`))
