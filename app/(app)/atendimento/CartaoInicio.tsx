'use client'

import Link from 'next/link'
import { ArrowRight, Hand, MessageCircle } from 'lucide-react'
import { Cartao, CabecalhoCartao, CorpoCartao, Esqueleto } from '@/app/ui'
import { useDados } from '@/lib/sessao'
import type { MetricasAtendimento } from '@/lib/atendimento/metricas'

/** Cartão do Atendimento na tela Início. */
export function CartaoAtendimento() {
  const { dados, erro } = useDados<MetricasAtendimento>('/api/whatsapp/metricas')
  const itens = dados
    ? [
        { rotulo: 'Conversas hoje', valor: String(dados.conversasHoje) },
        {
          rotulo: '1ª resposta',
          valor: dados.tempoMedioPrimeiraRespostaSeg == null ? '–' : dados.tempoMedioPrimeiraRespostaSeg < 60 ? `${dados.tempoMedioPrimeiraRespostaSeg}s` : `${Math.round(dados.tempoMedioPrimeiraRespostaSeg / 60)} min`,
        },
        { rotulo: 'Marcados pela IA', valor: String(dados.agendamentosPelaIA) },
        { rotulo: 'Sem humano', valor: dados.pctResolvidoSemHumano == null ? '–' : `${dados.pctResolvidoSemHumano}%` },
      ]
    : []
  return (
    <Cartao>
      <CabecalhoCartao
        icone={<MessageCircle className="text-atendimento" />}
        titulo="Atendimento"
        descricao="IA no WhatsApp hoje"
        acao={
          <Link href="/atendimento" className="inline-flex items-center gap-1 text-[13px] font-medium text-acento hover:underline">
            Abrir <ArrowRight className="size-3.5" />
          </Link>
        }
      />
      <CorpoCartao>
        {erro ? (
          <p className="text-sm text-texto-3">Sem dados do Atendimento.</p>
        ) : !dados ? (
          <Esqueleto className="h-16 w-full" />
        ) : (
          <>
            {dados.esperandoHumano > 0 && (
              <Link href="/atendimento" className="mb-3 flex items-center gap-2 rounded-lg bg-atencao/10 px-3 py-2 text-[13px] font-medium text-atencao">
                <Hand className="size-4" /> {dados.esperandoHumano} {dados.esperandoHumano === 1 ? 'cliente esperando' : 'clientes esperando'} a equipe
              </Link>
            )}
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {itens.map((i) => (
                <div key={i.rotulo}>
                  <dt className="text-xs text-texto-3">{i.rotulo}</dt>
                  <dd className="numero text-lg text-texto">{i.valor}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </CorpoCartao>
    </Cartao>
  )
}
