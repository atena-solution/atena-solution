// Monta as dependências do Atendimento no servidor: simulado (SIMULAR=1 / sem Firebase) ou real.

import 'server-only'
import { banco, simulando } from '@/lib/dados'
import { clienteIA } from '@/lib/integracoes/claude'
import * as whatsapp from '@/lib/integracoes/whatsapp'
import { RepoBanco, atomicoLocal } from './repo-banco'
import { cifrar, decifrar } from './cripto'
import { criarEnviarPush } from './push'
import { semearAtendimentoDemo } from './demo'
import { decidirAba, usoDaEmpresa } from '@/lib/planos/portao'
import type { CanalWhatsApp, Deps } from './processar'

/** Chave fixa SÓ para o modo simulado (nunca usada com dados reais). */
const CHAVE_SIMULADA = Buffer.alloc(32, 7).toString('base64')

export function chaveCripto(): string | undefined {
  if (process.env.ATENA_CHAVE_CRIPTO) return process.env.ATENA_CHAVE_CRIPTO
  return simulando() ? CHAVE_SIMULADA : undefined
}

export const cifrarToken = (t: string) => cifrar(t, chaveCripto())
export const decifrarToken = (t: string) => decifrar(t, chaveCripto())

function canal(): CanalWhatsApp {
  if (!simulando()) return { enviar: whatsapp.enviar, marcarLidaEDigitando: whatsapp.marcarLidaEDigitando }
  // simulado: tudo vai pra caixa de saída em memória
  return {
    async enviar(cred, para, conteudo) {
      const wamid = `wamid.SAIDA${Date.now()}${Math.random().toString(36).slice(2, 8)}`
      whatsapp.saidaSimulada().push({ para, phoneNumberId: cred.phoneNumberId, conteudo, wamid, em: new Date().toISOString() })
      return { ok: true, wamid }
    },
    async marcarLidaEDigitando() {},
  }
}

const g = globalThis as unknown as { __atenaAtendimentoSemeado?: Promise<void> }

export async function depsAtendimento(): Promise<Deps> {
  const b = await banco()
  let atomico = atomicoLocal(b)
  if (!simulando()) {
    const { atomicoFirestore } = await import('./atomico-firestore')
    atomico = atomicoFirestore()
  }
  const repo = new RepoBanco(b, atomico)
  if (simulando()) {
    g.__atenaAtendimentoSemeado ??= semearAtendimentoDemo(b, repo, cifrarToken)
    await g.__atenaAtendimentoSemeado
  }
  return {
    repo,
    ia: clienteIA(),
    canal: canal(),
    decifrar: decifrarToken,
    agora: () => new Date(),
    enviarPush: criarEnviarPush(repo),
    acessoAba: (empresaId) => decidirAba(empresaId, 'atendimento', 'escrever'),
    registrarUso: (empresaId, modelo, uso) => usoDaEmpresa(empresaId)(modelo, uso),
  }
}

/** Autorização do cron da Vercel: Authorization: Bearer $CRON_SECRET. */
export function cronAutorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return simulando()
  return req.headers.get('authorization') === `Bearer ${segredo}`
}
