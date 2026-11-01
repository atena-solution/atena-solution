import { describe, expect, it } from 'vitest'
import { _corpoEnvio, assinar, lerWebhook, verificarAssinatura, verificarDesafio, webhookDeTexto } from '@/lib/integracoes/whatsapp'

describe('webhook da Meta', () => {
  it('verificação GET devolve o challenge só com o token certo', () => {
    const p = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'segredo', 'hub.challenge': '123' })
    expect(verificarDesafio(p, 'segredo')).toBe('123')
    expect(verificarDesafio(p, 'outro')).toBeNull()
    expect(verificarDesafio(p, undefined)).toBeNull()
  })
  it('assinatura X-Hub-Signature-256', () => {
    const corpo = '{"a":1}'
    expect(verificarAssinatura(corpo, assinar(corpo, 'app'), 'app')).toBe(true)
    expect(verificarAssinatura(corpo, assinar(corpo, 'x'), 'app')).toBe(false)
    expect(verificarAssinatura(corpo, null, 'app')).toBe(false)
  })
  it('lê texto, áudio, imagem, botão e status', () => {
    const corpo = {
      object: 'whatsapp_business_account',
      entry: [{ id: 'W', changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: 'PN1' },
        contacts: [{ profile: { name: 'Carlos' }, wa_id: '5511988887777' }],
        messages: [
          { from: '5511988887777', id: 'w1', timestamp: '1793620800', type: 'text', text: { body: 'oi' } },
          { from: '5511988887777', id: 'w2', timestamp: '1793620801', type: 'audio', audio: { id: 'm1', mime_type: 'audio/ogg' } },
          { from: '5511988887777', id: 'w3', timestamp: '1793620802', type: 'image', image: { id: 'm2', caption: 'olha' } },
          { from: '5511988887777', id: 'w4', timestamp: '1793620803', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'b', title: 'Confirmar' } } },
        ],
        statuses: [{ id: 'out1', status: 'read', timestamp: '1793620804', recipient_id: '5511988887777' }],
      } }] }],
    }
    const ev = lerWebhook(corpo)
    expect(ev.map((e) => (e.tipo === 'mensagem' ? e.tipoMsg : e.status))).toEqual(['texto', 'audio', 'imagem', 'botao', 'read'])
    expect(ev[0]).toMatchObject({ phoneNumberId: 'PN1', wamid: 'w1', de: '5511988887777', nome: 'Carlos', texto: 'oi' })
    expect(ev[1]).toMatchObject({ midiaId: 'm1' })
    expect(ev[3]).toMatchObject({ texto: 'Confirmar' })
  })
  it('ignora corpo que não é da Meta', () => {
    expect(lerWebhook({ object: 'page' })).toEqual([])
    expect(lerWebhook(null)).toEqual([])
  })
  it('monta envio de texto e de modelo como a doc da Meta', () => {
    expect(_corpoEnvio('55119', { tipo: 'texto', texto: 'Oi' })).toEqual({ messaging_product: 'whatsapp', recipient_type: 'individual', to: '55119', type: 'text', text: { body: 'Oi', preview_url: false } })
    expect(_corpoEnvio('55119', { tipo: 'modelo', nome: 'lembrete', idioma: 'pt_BR', parametros: ['Carlos'] })).toMatchObject({
      type: 'template', template: { name: 'lembrete', language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Carlos' }] }] },
    })
  })
  it('webhook simulado é lido igual ao real', () => {
    const [e] = lerWebhook(webhookDeTexto({ phoneNumberId: 'PN9', de: '5511', texto: 'teste', wamid: 'x1' }))
    expect(e).toMatchObject({ tipo: 'mensagem', phoneNumberId: 'PN9', wamid: 'x1', texto: 'teste' })
  })
})
