'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing } from 'lucide-react'
import { Botao, useToast } from '@/app/ui'
import { useSessao } from '@/lib/sessao'

// Web push: registra o service worker e manda a inscrição pro servidor.
// Doc (consultada em 01/11/2026, developer.mozilla.org/docs/Web/API/PushManager/subscribe). CONFIRMAR AO VIVO

function chaveParaBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const bruto = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0))
}

export function AtivarAvisos() {
  const { api } = useSessao()
  const { avisar } = useToast()
  const [estado, setEstado] = useState<'carregando' | 'indisponivel' | 'desligado' | 'ligado'>('carregando')
  const [chave, setChave] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('indisponivel')
      return
    }
    api<{ chavePublica: string | null }>('/api/whatsapp/push')
      .then(async (r) => {
        if (!r.chavePublica) return setEstado('indisponivel')
        setChave(r.chavePublica)
        const reg = await navigator.serviceWorker.getRegistration('/sw-atendimento.js')
        const sub = await reg?.pushManager.getSubscription()
        setEstado(sub && Notification.permission === 'granted' ? 'ligado' : 'desligado')
      })
      .catch(() => setEstado('indisponivel'))
  }, [api])

  async function ligar() {
    if (!chave) return
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') return avisar('Sem permissão de notificação no navegador.', 'atencao')
      const reg = await navigator.serviceWorker.register('/sw-atendimento.js')
      await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) })
      await api('/api/whatsapp/push', { corpo: sub.toJSON() })
      setEstado('ligado')
      avisar('Pronto! Você recebe aviso quando um cliente esperar a equipe.', 'sucesso')
    } catch (e) {
      avisar((e as Error).message || 'Não deu pra ligar os avisos.', 'erro')
    }
  }

  if (estado === 'indisponivel' || estado === 'carregando') return null
  return (
    <Botao
      variante="fantasma"
      tamanho="p"
      icone={estado === 'ligado' ? <BellRing className="size-4 text-atendimento" /> : <Bell className="size-4" />}
      onClick={estado === 'ligado' ? undefined : ligar}
      aria-pressed={estado === 'ligado'}
    >
      {estado === 'ligado' ? 'Avisos ligados' : 'Ligar avisos'}
    </Botao>
  )
}
