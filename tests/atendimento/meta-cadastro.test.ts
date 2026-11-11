import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { concluirCadastro } from '@/lib/integracoes/meta-cadastro'

function fetchFalso(respostas: Record<string, unknown>) {
  const chamadas: { url: string; metodo: string; corpo?: any }[] = []
  const f = (async (url: string, init?: RequestInit) => {
    chamadas.push({ url, metodo: init?.method ?? 'GET', corpo: init?.body ? JSON.parse(String(init.body)) : undefined })
    const chave = Object.keys(respostas).find((k) => url.includes(k))
    return new Response(JSON.stringify(chave ? respostas[chave] : { success: true }), { status: 200 })
  }) as unknown as typeof fetch
  return { f, chamadas }
}

describe('cadastro incorporado da Meta', () => {
  const env = { ...process.env }
  beforeEach(() => Object.assign(process.env, { META_APP_ID: 'APP', META_ES_CONFIG_ID: 'CFG', WHATSAPP_APP_SECRET: 'SEG', SIMULAR: '' }))
  afterEach(() => (process.env = { ...env }))

  it('coexistência: troca o código, assina o webhook, NÃO registra o número e pede a sincronização', async () => {
    const { f, chamadas } = fetchFalso({
      'oauth/access_token': { access_token: 'TK' },
      'phone_numbers': { data: [{ id: 'PN9' }] },
      'PN9?fields': { display_phone_number: '+55 11 99999-0000', verified_name: 'Barbearia', is_on_biz_app: true, platform_type: 'CLOUD_API' },
      'smb_app_data': { request_id: 'R1' },
    })
    const r = await concluirCadastro({ code: 'C', modo: 'app', wabaId: 'W1' }, f)
    expect(r).toMatchObject({ token: 'TK', wabaId: 'W1', phoneNumberId: 'PN9', coexistencia: true, nome: 'Barbearia' })
    expect(r.pin).toBeUndefined()
    expect(chamadas[0].url).toContain('client_id=APP')
    expect(chamadas[0].url).toContain('client_secret=SEG')
    expect(chamadas.some((c) => c.url.endsWith('W1/subscribed_apps') && c.metodo === 'POST')).toBe(true)
    expect(chamadas.some((c) => c.url.includes('/register'))).toBe(false)
    expect(chamadas.filter((c) => c.url.includes('smb_app_data')).map((c) => c.corpo.sync_type)).toEqual(['smb_app_state_sync', 'history'])
  })

  it('número novo: registra com PIN de 6 dígitos e não sincroniza', async () => {
    const { f, chamadas } = fetchFalso({ 'oauth/access_token': { access_token: 'TK' }, 'PN1?fields': { display_phone_number: '+55 11 1', is_on_biz_app: false } })
    const r = await concluirCadastro({ code: 'C', modo: 'novo', wabaId: 'W1', phoneNumberId: 'PN1' }, f)
    const reg = chamadas.find((c) => c.url.endsWith('PN1/register'))
    expect(reg?.corpo).toMatchObject({ messaging_product: 'whatsapp' })
    expect(reg?.corpo.pin).toMatch(/^\d{6}$/)
    expect(r.pin).toBe(reg?.corpo.pin)
    expect(r.coexistencia).toBe(false)
    expect(chamadas.some((c) => c.url.includes('smb_app_data'))).toBe(false)
  })

  it('sem as chaves da Meta recusa com mensagem clara', async () => {
    delete process.env.META_ES_CONFIG_ID
    await expect(concluirCadastro({ code: 'C', modo: 'app', wabaId: 'W' })).rejects.toThrow(/ainda não liberada/)
  })
})
