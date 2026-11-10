'use client'

import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { Botao, Campo, Modal, AreaTexto, useToast } from '@/app/ui'
import { useSessao } from '@/lib/sessao'

/** Só no modo simulado: manda uma mensagem "como cliente" pelo webhook, pra ver a IA respondendo na caixa. */
export function SimularCliente({ aoEnviar }: { aoEnviar: (conversaId?: string) => void }) {
  const { api } = useSessao()
  const { avisar } = useToast()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('Cliente teste')
  const [telefone, setTelefone] = useState('(11) 90000-1111')
  const [texto, setTexto] = useState('Oi! Tem horário amanhã à tarde?')
  const [enviando, setEnviando] = useState(false)

  async function enviar() {
    setEnviando(true)
    try {
      const r = await api<{ conversaId?: string }>('/api/whatsapp/simular-cliente', { corpo: { nome, telefone, texto } })
      avisar('Mensagem chegou. A IA responde em ~8s (espera a rajada).', 'sucesso')
      setTexto('')
      aoEnviar(r.conversaId)
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Botao variante="secundario" tamanho="p" icone={<FlaskConical className="size-4" />} onClick={() => setAberto(true)}>
        Simular cliente
      </Botao>
      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Simular cliente no WhatsApp"
        descricao="Modo de teste: a mensagem entra pelo webhook como se viesse da Meta."
        largura="p"
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setAberto(false)}>
              Fechar
            </Botao>
            <Botao onClick={enviar} carregando={enviando} disabled={!texto.trim()}>
              Enviar como cliente
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Nome no WhatsApp" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Campo rotulo="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" />
          </div>
          <AreaTexto
            rotulo="Mensagem"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void enviar()
              }
            }}
          />
        </div>
      </Modal>
    </>
  )
}
