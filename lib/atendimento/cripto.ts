// Cifra do token do WhatsApp (AES-256-GCM). Chave em ATENA_CHAVE_CRIPTO (32 bytes em base64).
// Gerar: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function chave(chaveB64?: string): Buffer {
  const b64 = chaveB64 ?? process.env.ATENA_CHAVE_CRIPTO
  if (!b64) throw new Error('ATENA_CHAVE_CRIPTO não configurada')
  const k = Buffer.from(b64, 'base64')
  if (k.length !== 32) throw new Error('ATENA_CHAVE_CRIPTO precisa ter 32 bytes (base64)')
  return k
}

export function cifrar(texto: string, chaveB64?: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', chave(chaveB64), iv)
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()])
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), dados.toString('base64')].join(':')
}

export function decifrar(cifrado: string, chaveB64?: string): string {
  const [versao, iv, tag, dados] = cifrado.split(':')
  if (versao !== 'v1' || !iv || !tag || !dados) throw new Error('Formato de token cifrado inválido')
  const d = createDecipheriv('aes-256-gcm', chave(chaveB64), Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(dados, 'base64')), d.final()]).toString('utf8')
}

/** "EAAG…x9Q2" — para mostrar na tela sem expor o token. */
export function mascarar(token: string): string {
  if (token.length <= 8) return '••••'
  return `${token.slice(0, 4)}…${token.slice(-4)}`
}
