'use client'

// Botão "Conectar com a Meta" (Cadastro Incorporado v4). Doc oficial lida em 10/11/2026 — ver lib/integracoes/meta-cadastro.ts.
import { useEffect, useRef, useState } from 'react'
import { Smartphone, Sparkles } from 'lucide-react'
import { Botao, Cartao, CabecalhoCartao, CorpoCartao, useToast } from '@/app/ui'
import { useDados, useSessao } from '@/lib/sessao'

interface Config {
  disponivel: boolean
  appId: string | null
  configId: string | null
  versao: string
}

declare global {
  interface Window {
    FB?: any
    fbAsyncInit?: () => void
  }
}

function carregarSdk(appId: string, versao: string): Promise<void> {
  return new Promise((ok, falhou) => {
    if (window.FB) return ok()
    window.fbAsyncInit = () => {
      window.FB.init({ appId, autoLogAppEvents: true, xfbml: true, version: versao })
      ok()
    }
    const s = document.createElement('script')
    s.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    s.async = true
    s.defer = true
    s.crossOrigin = 'anonymous'
    s.onerror = () => falhou(new Error('Não deu pra abrir o login da Meta. Desligue o bloqueador de anúncios e tente de novo.'))
    document.body.appendChild(s)
  })
}

export function ConectarMeta({ simulado, aoConectar }: { simulado: boolean; aoConectar: () => void }) {
  const { api } = useSessao()
  const { avisar } = useToast()
  const { dados: cfg } = useDados<Config>('/api/whatsapp/cadastro')
  const [rodando, setRodando] = useState<'app' | 'novo' | null>(null)
  const sessaoMeta = useRef<{ wabaId?: string; phoneNumberId?: string; fim?: string }>({})

  // A janela da Meta avisa por postMessage quais conta e número a pessoa escolheu.
  useEffect(() => {
    function ouvir(ev: MessageEvent) {
      if (!String(ev.origin).endsWith('facebook.com')) return
      try {
        const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data
        if (d?.type !== 'WA_EMBEDDED_SIGNUP') return
        if (d.event === 'CANCEL') sessaoMeta.current = { fim: 'CANCEL' }
        else if (d.event === 'ERROR') sessaoMeta.current = { fim: `ERRO: ${d.data?.error_message ?? ''}` }
        else sessaoMeta.current = { wabaId: d.data?.waba_id, phoneNumberId: d.data?.phone_number_id, fim: d.event }
      } catch {
        /* outras mensagens do Facebook */
      }
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [])

  async function concluir(modo: 'app' | 'novo', code: string) {
    const s = sessaoMeta.current
    const r = await api<{ numero: string; nome: string; coexistencia: boolean }>('/api/whatsapp/cadastro', {
      corpo: { modo, code, wabaId: s.wabaId, phoneNumberId: s.phoneNumberId },
    })
    avisar(`WhatsApp conectado: ${r.nome || r.numero}${r.coexistencia ? ' — continua no app do celular' : ''}`, 'sucesso')
    aoConectar()
  }

  async function conectar(modo: 'app' | 'novo') {
    setRodando(modo)
    sessaoMeta.current = {}
    try {
      if (simulado) {
        await concluir(modo, 'simulado')
        return
      }
      if (!cfg?.disponivel || !cfg.appId || !cfg.configId) throw new Error('Conexão automática ainda não liberada pela Meta. Use a conexão manual abaixo ou fale com a Atena.')
      await carregarSdk(cfg.appId, cfg.versao)
      const extras: Record<string, unknown> = { setup: {} }
      if (modo === 'app') Object.assign(extras, { featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: '3' })
      const code = await new Promise<string>((ok, falhou) => {
        window.FB.login(
          (resp: any) => {
            const c = resp?.authResponse?.code
            if (c) ok(c)
            else falhou(new Error(sessaoMeta.current.fim?.startsWith('ERRO') ? sessaoMeta.current.fim : 'Conexão cancelada.'))
          },
          { config_id: cfg.configId, response_type: 'code', override_default_response_type: true, extras },
        )
      })
      await concluir(modo, code)
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setRodando(null)
    }
  }

  return (
    <Cartao className="border-atendimento/40">
      <CabecalhoCartao titulo="Conectar em 2 minutos" descricao="Entre com o Facebook da empresa e escolha o número. A Atena faz o resto." />
      <CorpoCartao className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl bg-superficie-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-texto">
            <Smartphone className="size-4 text-atendimento" /> Já uso o WhatsApp Business
          </p>
          <p className="text-[13px] leading-relaxed text-texto-2">
            Mesmo número, mesmas conversas. Você continua usando o app no celular e a IA responde junto. Quando você responder pelo celular, a IA para naquela conversa.
          </p>
          <p className="text-xs text-texto-3">Precisa do app WhatsApp Business atualizado. Grupos e listas de transmissão não passam pela Atena.</p>
          <Botao onClick={() => conectar('app')} carregando={rodando === 'app'} disabled={!!rodando} icone={<Sparkles className="size-4" />}>
            Conectar meu WhatsApp Business
          </Botao>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-superficie-2 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-texto">
            <Sparkles className="size-4 text-acento" /> Número novo só pra IA
          </p>
          <p className="text-[13px] leading-relaxed text-texto-2">
            Um chip que não está em nenhum WhatsApp. A Meta manda um código por SMS ou ligação pra confirmar.
          </p>
          <p className="text-xs text-texto-3">Esse número não poderá ser usado no app do celular.</p>
          <Botao variante="secundario" onClick={() => conectar('novo')} carregando={rodando === 'novo'} disabled={!!rodando}>
            Conectar número novo
          </Botao>
        </div>
        {cfg && !cfg.disponivel && !simulado && (
          <p className="text-[13px] text-atencao sm:col-span-2">A conexão automática está aguardando a aprovação da Meta. Enquanto isso, use a conexão manual abaixo.</p>
        )}
      </CorpoCartao>
    </Cartao>
  )
}
