'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { GraduationCap, MessageCircle, Plug, Search } from 'lucide-react'
import { Botao, Campo, Selo, Vazio, cx, Esqueleto } from '@/app/ui'
import { useDados, useSessao } from '@/lib/sessao'
import { FILTROS, contarPorFiltro, filtrarConversas, type Filtro } from '@/lib/atendimento/caixa'
import type { MetricasAtendimento } from '@/lib/atendimento/metricas'
import { useAgora, useConversas } from './_lib/tempoReal'
import { ItemConversa } from './ItemConversa'
import { PainelConversa } from './PainelConversa'
import { SimularCliente } from './SimularCliente'
import { AtivarAvisos } from './AtivarAvisos'

export function TelaAtendimento() {
  const { sessao } = useSessao()
  const router = useRouter()
  const params = useSearchParams()
  const selecionada = params.get('c')
  const [filtro, setFiltro] = useState<Filtro>('abertas')
  const [busca, setBusca] = useState('')
  const agora = useAgora()
  const { conversas, carregando, erro, aoVivo } = useConversas()
  const { dados: conexao } = useDados<{ conectado: boolean; simulado: boolean }>('/api/whatsapp/conexao')

  const lista = useMemo(() => filtrarConversas(conversas ?? [], filtro, sessao?.uid, busca), [conversas, filtro, sessao?.uid, busca])
  const contagem = useMemo(() => contarPorFiltro(conversas ?? [], sessao?.uid), [conversas, sessao?.uid])

  const abrir = (id: string | null) => router.replace(id ? `/atendimento?c=${encodeURIComponent(id)}` : '/atendimento', { scroll: false })

  if (conexao && !conexao.conectado && !carregando && !(conversas ?? []).length) {
    return (
      <div className="mx-auto max-w-xl pt-10">
        <Vazio
          icone={<Plug />}
          titulo="Conecte o WhatsApp da empresa"
          descricao="Em poucos passos a sua atendente de IA começa a responder os clientes na hora, 24h por dia."
          acao={
            <Link href="/atendimento/conexao">
              <Botao>Conectar número</Botao>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header className={cx('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', selecionada && 'hidden md:flex')}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-texto">Atendimento</h1>
          {aoVivo && (
            <Selo tom="atendimento" aoVivo>
              Ao vivo
            </Selo>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {conexao?.simulado && <SimularCliente aoEnviar={(id) => id && abrir(id)} />}
          <AtivarAvisos />
          <Link href="/atendimento/treinar">
            <Botao variante="secundario" tamanho="p" icone={<GraduationCap className="size-4" />}>
              Treinar a IA
            </Botao>
          </Link>
          <Link href="/atendimento/conexao">
            <Botao variante="fantasma" tamanho="p" icone={<Plug className="size-4" />}>
              WhatsApp
            </Botao>
          </Link>
        </div>
      </header>

      <div className={cx(selecionada && 'hidden md:block')}>
        <FaixaMetricas />
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-4 md:h-[calc(100dvh-15rem)] md:min-h-[520px] md:grid-cols-[minmax(280px,340px)_1fr]">
        {/* Lista */}
        <section aria-label="Conversas" className={cx('flex min-h-0 min-w-0 flex-col rounded-cartao border border-borda bg-superficie', selecionada && 'hidden md:flex')}>
          <div className="flex flex-col gap-3 border-b border-borda p-3">
            <Campo
              aria-label="Buscar conversa"
              placeholder="Buscar por nome ou telefone"
              icone={<Search />}
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div role="tablist" aria-label="Filtros" className="flex flex-wrap gap-1">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filtro === f.id}
                  onClick={() => setFiltro(f.id)}
                  className={cx(
                    'inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
                    filtro === f.id ? 'border-transparent bg-texto text-fundo' : 'border-borda text-texto-2 hover:border-borda-forte hover:text-texto',
                  )}
                >
                  {f.nome}
                  <span
                    className={cx(
                      'numero rounded-full px-1.5 text-[11px]',
                      f.id === 'humano' && contagem.humano > 0 && filtro !== f.id ? 'bg-atencao/15 text-atencao' : 'opacity-70',
                    )}
                  >
                    {contagem[f.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {erro && <p className="p-4 text-sm text-erro">{erro}</p>}
            {carregando ? (
              <div className="flex flex-col gap-3 p-3">
                {[0, 1, 2, 3].map((i) => (
                  <Esqueleto key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : lista.length === 0 ? (
              <Vazio
                icone={<MessageCircle />}
                titulo={filtro === 'humano' ? 'Ninguém esperando a equipe' : filtro === 'minhas' ? 'Nenhuma conversa com você' : 'Nenhuma conversa aqui'}
                descricao={
                  filtro === 'humano'
                    ? 'Quando a IA chamar alguém, a conversa aparece aqui.'
                    : filtro === 'minhas'
                      ? 'Assuma uma conversa para ela aparecer aqui.'
                      : 'Assim que um cliente chamar no WhatsApp, a conversa aparece na hora.'
                }
              />
            ) : (
              <ul className="flex flex-col p-1.5">
                {lista.map((c) => (
                  <li key={c.id}>
                    <ItemConversa conversa={c} agora={agora} ativa={c.id === selecionada} aoAbrir={() => abrir(c.id)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Conversa */}
        <section aria-label="Conversa" className={cx('min-h-0 min-w-0', !selecionada && 'hidden md:block')}>
          {selecionada ? (
            <PainelConversa key={selecionada} id={selecionada} aoVoltar={() => abrir(null)} agora={agora} />
          ) : (
            <div className="flex h-full items-center justify-center rounded-cartao border border-dashed border-borda">
              <Vazio icone={<MessageCircle />} titulo="Escolha uma conversa" descricao="A IA continua respondendo enquanto você olha. Assuma quando quiser." />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function FaixaMetricas() {
  const { dados } = useDados<MetricasAtendimento>('/api/whatsapp/metricas')
  const itens = [
    { rotulo: 'Conversas hoje', valor: dados ? String(dados.conversasHoje) : '–' },
    {
      rotulo: '1ª resposta (média)',
      valor: dados?.tempoMedioPrimeiraRespostaSeg == null ? '–' : dados.tempoMedioPrimeiraRespostaSeg < 60 ? `${dados.tempoMedioPrimeiraRespostaSeg}s` : `${Math.round(dados.tempoMedioPrimeiraRespostaSeg / 60)} min`,
    },
    { rotulo: 'Marcados pela IA hoje', valor: dados ? String(dados.agendamentosPelaIA) : '–' },
    { rotulo: 'Resolvido sem humano', valor: dados?.pctResolvidoSemHumano == null ? '–' : `${dados.pctResolvidoSemHumano}%` },
  ]
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-cartao border border-borda bg-borda sm:grid-cols-4">
      {itens.map((i) => (
        <div key={i.rotulo} className="bg-superficie px-4 py-3">
          <dt className="text-xs text-texto-3">{i.rotulo}</dt>
          <dd className="numero mt-0.5 text-xl text-texto">{i.valor}</dd>
        </div>
      ))}
    </dl>
  )
}
