'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeft, Bot, CalendarCheck, Hand, Plus, RotateCcw, Send, Sparkles, Trash2, X } from 'lucide-react'
import { AreaTexto, Botao, Campo, Cartao, CabecalhoCartao, CorpoCartao, Esqueleto, Selo, cx, useToast } from '@/app/ui'
import { useDados, useSessao } from '@/lib/sessao'
import type { Treino } from '@/lib/atendimento/tipos'
import type { FalaSimulador, RespostaSimulador } from '@/lib/atendimento/simulador'
import { Interruptor } from '../Interruptor'

export function TelaTreinar() {
  const { api, sessao } = useSessao()
  const { avisar } = useToast()
  const { dados, erro } = useDados<{ treino: Treino; conectado: boolean; servicos: number }>('/api/whatsapp/treino')
  const [t, setT] = useState<Treino | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [mudou, setMudou] = useState(false)
  const podeEditar = sessao?.papel === 'dono' || sessao?.papel === 'gestor'

  useEffect(() => {
    if (dados && !t) setT(dados.treino)
  }, [dados, t])

  function mudar<K extends keyof Treino>(k: K, v: Treino[K]) {
    setT((x) => (x ? { ...x, [k]: v } : x))
    setMudou(true)
  }

  async function salvar() {
    if (!t) return
    setSalvando(true)
    setErros({})
    try {
      const r = await api<{ treino: Treino }>('/api/whatsapp/treino', { metodo: 'PUT', corpo: t })
      setT(r.treino)
      setMudou(false)
      avisar('Treino salvo. A IA já usa as novidades.', 'sucesso')
    } catch (e) {
      const err = e as Error & { erros?: Record<string, string> }
      if (err.erros) setErros(err.erros)
      avisar(err.message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  if (erro) return <p className="text-sm text-erro">{erro}</p>
  if (!t || !dados)
    return (
      <div className="flex flex-col gap-4">
        <Esqueleto className="h-8 w-64" />
        <Esqueleto className="h-40 w-full" />
      </div>
    )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/atendimento" className="mb-2 inline-flex items-center gap-1 text-[13px] text-texto-3 hover:text-texto">
            <ArrowLeft className="size-3.5" /> Atendimento
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-texto">Treinar a IA</h1>
          <p className="mt-1 text-sm text-texto-2">Ensine como a sua empresa atende. Teste no simulador antes de ligar no WhatsApp.</p>
        </div>
        {podeEditar && (
          <Botao onClick={salvar} carregando={salvando} disabled={!mudou}>
            {mudou ? 'Salvar treino' : 'Tudo salvo'}
          </Botao>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        <fieldset disabled={!podeEditar} className="flex min-w-0 flex-col gap-5">
          <Cartao className={cx(t.ligada && 'border-atendimento/40')}>
            <CorpoCartao className="flex flex-col gap-4">
              <Interruptor
                rotulo={t.ligada ? 'IA ligada no WhatsApp' : 'IA desligada'}
                descricao={
                  !dados.conectado
                    ? 'Conecte o número do WhatsApp para poder ligar.'
                    : t.ligada
                      ? 'Respondendo os clientes na hora, 24h. A equipe assume quando quiser.'
                      : 'Só a equipe responde. Use o simulador para testar antes de ligar.'
                }
                ligado={t.ligada}
                desativado={!dados.conectado}
                aoMudar={(v) => mudar('ligada', v)}
              />
              {!dados.conectado && (
                <Link href="/atendimento/conexao" className="text-[13px] font-medium text-acento hover:underline">
                  Conectar o WhatsApp →
                </Link>
              )}
              {dados.servicos === 0 && (
                <p className="rounded-lg bg-atencao/10 px-3 py-2 text-[13px] text-atencao">
                  Cadastre os serviços com preço e duração (Configurações) para a IA conseguir marcar horários.
                </p>
              )}
            </CorpoCartao>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Jeito de falar" descricao="Como a assistente se apresenta e o tom das respostas." />
            <CorpoCartao className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <Campo rotulo="Nome da assistente" value={t.nomeAssistente} erro={erros.nomeAssistente} onChange={(e) => mudar('nomeAssistente', e.target.value)} />
              <Campo rotulo="Tom de voz" placeholder="Ex.: acolhedor, leve e direto" value={t.tom} onChange={(e) => mudar('tom', e.target.value)} />
            </CorpoCartao>
          </Cartao>

          <Cartao>
            <CabecalhoCartao
              titulo="Perguntas e respostas"
              descricao="O que os clientes mais perguntam. A IA responde com as suas palavras e nunca inventa."
              acao={
                <Botao variante="secundario" tamanho="p" icone={<Plus className="size-4" />} onClick={() => mudar('perguntas', [...t.perguntas, { pergunta: '', resposta: '' }])}>
                  Adicionar
                </Botao>
              }
            />
            <CorpoCartao className="flex flex-col gap-3">
              {t.perguntas.length === 0 && (
                <p className="rounded-xl border border-dashed border-borda px-4 py-6 text-center text-[13px] text-texto-2">
                  Comece pelas 5 perguntas mais comuns: formas de pagamento, estacionamento, como funciona a primeira vez…
                </p>
              )}
              {t.perguntas.map((q, i) => (
                <div key={i} className="group relative rounded-xl border border-borda p-3">
                  <div className="grid gap-2">
                    <Campo
                      aria-label={`Pergunta ${i + 1}`}
                      placeholder="Pergunta do cliente"
                      value={q.pergunta}
                      erro={erros[`perguntas.${i}`]}
                      onChange={(e) => mudar('perguntas', t.perguntas.map((x, j) => (j === i ? { ...x, pergunta: e.target.value } : x)))}
                    />
                    <AreaTexto
                      aria-label={`Resposta ${i + 1}`}
                      placeholder="Como a empresa responde"
                      className="min-h-16"
                      value={q.resposta}
                      onChange={(e) => mudar('perguntas', t.perguntas.map((x, j) => (j === i ? { ...x, resposta: e.target.value } : x)))}
                    />
                  </div>
                  <button
                    onClick={() => mudar('perguntas', t.perguntas.filter((_, j) => j !== i))}
                    className="absolute right-2 top-2 rounded-lg p-1.5 text-texto-3 opacity-60 hover:bg-superficie-2 hover:text-erro group-hover:opacity-100"
                    aria-label={`Remover pergunta ${i + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </CorpoCartao>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Limites" descricao="O que a IA nunca fala e quando ela chama alguém da equipe." />
            <CorpoCartao className="flex flex-col gap-5">
              <ListaDeFrases rotulo="Nunca dizer / nunca falar sobre" exemplo="Ex.: dar desconto, diagnóstico médico" itens={t.nuncaDizer} aoMudar={(v) => mudar('nuncaDizer', v)} />
              <ListaDeFrases
                rotulo="Chamar humano quando o cliente falar de"
                exemplo="Ex.: alergia, gestante, orçamento de festa"
                ajuda="Reclamação, reembolso, assunto jurídico e urgência de saúde já vão pra equipe automaticamente."
                itens={t.quandoChamarHumano}
                aoMudar={(v) => mudar('quandoChamarHumano', v)}
              />
              <AreaTexto
                rotulo="Regras extras (opcional)"
                placeholder="Ex.: Para menores de 16 anos, pedir que venham com um responsável."
                value={t.regrasExtras}
                onChange={(e) => mudar('regrasExtras', e.target.value)}
              />
            </CorpoCartao>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Automação da agenda" descricao="Mensagens que saem sozinhas, sem ninguém lembrar." />
            <CorpoCartao className="flex flex-col gap-4">
              <Interruptor rotulo="Lembrete na véspera" descricao='Com "Responda SIM pra confirmar". O SIM confirma na agenda.' ligado={t.automacoes.lembreteVespera} aoMudar={(v) => mudar('automacoes', { ...t.automacoes, lembreteVespera: v })} />
              <Interruptor rotulo="Lembrete 1h antes" ligado={t.automacoes.lembreteUmaHora} aoMudar={(v) => mudar('automacoes', { ...t.automacoes, lembreteUmaHora: v })} />
              <Interruptor rotulo="Recuperar quem faltou" descricao="No mesmo dia, oferece um novo horário." ligado={t.automacoes.recuperarFalta} aoMudar={(v) => mudar('automacoes', { ...t.automacoes, recuperarFalta: v })} />
              <Interruptor rotulo="Pedir avaliação no Google" descricao="1h depois do atendimento de quem compareceu." ligado={t.automacoes.pedirAvaliacao} aoMudar={(v) => mudar('automacoes', { ...t.automacoes, pedirAvaliacao: v })} />
              {t.automacoes.pedirAvaliacao && (
                <Campo rotulo="Link de avaliação do Google" placeholder="https://g.page/r/…/review" value={t.linkAvaliacao ?? ''} erro={erros.linkAvaliacao} onChange={(e) => mudar('linkAvaliacao', e.target.value)} />
              )}
              <div className="border-t border-borda pt-4">
                <Campo
                  rotulo="Avisar a equipe quando o cliente esperar por mais de (minutos)"
                  type="number"
                  min={1}
                  max={120}
                  className="max-w-28"
                  value={String(t.avisoHumanoMin)}
                  erro={erros.avisoHumanoMin}
                  onChange={(e) => mudar('avisoHumanoMin', Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-texto-3">Fora da janela de 24h do WhatsApp, as mensagens usam os modelos aprovados cadastrados na conexão.</p>
            </CorpoCartao>
          </Cartao>

          <Cartao>
            <CabecalhoCartao
              titulo="Mensagens rápidas"
              descricao="Para a equipe: digite / na conversa. Use {endereco}, {telefone}, {empresa}, {nome}."
              acao={
                <Botao variante="secundario" tamanho="p" icone={<Plus className="size-4" />} onClick={() => mudar('mensagensRapidas', [...t.mensagensRapidas, { atalho: '', texto: '' }])}>
                  Adicionar
                </Botao>
              }
            />
            <CorpoCartao className="flex flex-col gap-2">
              {t.mensagensRapidas.map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Campo aria-label="Atalho" className="w-24" placeholder="atalho" value={m.atalho} onChange={(e) => mudar('mensagensRapidas', t.mensagensRapidas.map((x, j) => (j === i ? { ...x, atalho: e.target.value } : x)))} />
                  <div className="flex-1">
                    <Campo aria-label="Texto" placeholder="Texto da mensagem" value={m.texto} onChange={(e) => mudar('mensagensRapidas', t.mensagensRapidas.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))} />
                  </div>
                  <button onClick={() => mudar('mensagensRapidas', t.mensagensRapidas.filter((_, j) => j !== i))} className="mt-1 rounded-lg p-2 text-texto-3 hover:bg-superficie-2 hover:text-erro" aria-label="Remover">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </CorpoCartao>
          </Cartao>
        </fieldset>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Simulador rascunho={t} />
        </div>
      </div>
    </div>
  )
}

function ListaDeFrases({ rotulo, exemplo, ajuda, itens, aoMudar }: { rotulo: string; exemplo: string; ajuda?: string; itens: string[]; aoMudar: (v: string[]) => void }) {
  const [novo, setNovo] = useState('')
  const adicionar = () => {
    const v = novo.trim()
    if (v && !itens.includes(v)) aoMudar([...itens, v])
    setNovo('')
  }
  return (
    <div className="flex flex-col gap-2">
      <Campo
        rotulo={rotulo}
        placeholder={exemplo}
        ajuda={ajuda ?? 'Escreva e aperte Enter.'}
        value={novo}
        onChange={(e) => setNovo(e.target.value)}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            adicionar()
          }
        }}
        onBlur={adicionar}
      />
      {itens.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {itens.map((x) => (
            <span key={x} className="inline-flex items-center gap-1 rounded-full border border-borda bg-superficie-2 py-0.5 pl-2.5 pr-1 text-[13px] text-texto">
              {x}
              <button onClick={() => aoMudar(itens.filter((y) => y !== x))} className="rounded-full p-0.5 text-texto-3 hover:text-erro" aria-label={`Remover ${x}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface FalaTela extends FalaSimulador {
  extra?: ReactNode
}

function Simulador({ rascunho }: { rascunho: Treino }) {
  const { api } = useSessao()
  const [falas, setFalas] = useState<FalaTela[]>([])
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [falas.length, pensando])

  async function enviar(t = texto) {
    const msg = t.trim()
    if (!msg || pensando) return
    const novas: FalaTela[] = [...falas, { de: 'cliente', texto: msg }]
    setFalas(novas)
    setTexto('')
    setPensando(true)
    try {
      const r = await api<RespostaSimulador>('/api/whatsapp/simulador', {
        corpo: { falas: novas.map(({ de, texto }) => ({ de, texto })), treino: rascunho },
      })
      const extra =
        r.humano || r.agendou || r.ferramentas.length ? (
          <span className="flex flex-wrap gap-1">
            {r.humano && (
              <Selo tom="atencao">
                <Hand className="size-3" /> Chamaria a equipe: {r.humano}
              </Selo>
            )}
            {r.agendou && (
              <Selo tom="sucesso">
                <CalendarCheck className="size-3" /> Marcaria (teste, nada foi gravado)
              </Selo>
            )}
            {!r.humano && !r.agendou && r.ferramentas.includes('ver_horarios_livres') && <Selo tom="atendimento">Consultou a agenda</Selo>}
          </span>
        ) : undefined
      setFalas([...novas, ...r.baloes.map((b, i) => ({ de: 'ia' as const, texto: b, extra: i === r.baloes.length - 1 ? extra : undefined }))])
    } catch (e) {
      setFalas([...novas, { de: 'ia', texto: `⚠️ ${(e as Error).message}` }])
    } finally {
      setPensando(false)
    }
  }

  const sugestoes = ['Oi! Quanto custa?', 'Tem horário amanhã à tarde?', 'Você é um robô?', 'Quero reclamar do atendimento']

  return (
    <Cartao className="flex h-[min(640px,calc(100dvh-8rem))] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-borda px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-atendimento/15 text-atendimento">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-texto">Simulador</p>
            <p className="text-[11px] text-texto-3">Converse como cliente. Usa o rascunho, sem salvar.</p>
          </div>
        </div>
        {falas.length > 0 && (
          <button onClick={() => setFalas([])} className="rounded-lg p-1.5 text-texto-3 hover:bg-superficie-2 hover:text-texto" aria-label="Recomeçar">
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-fundo/50 px-3 py-4" aria-live="polite">
        {falas.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <Bot className="size-8 text-atendimento" />
            <p className="max-w-60 text-[13px] text-texto-2">Escreva como se fosse um cliente chegando no WhatsApp.</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {sugestoes.map((s) => (
                <button key={s} onClick={() => enviar(s)} className="rounded-full border border-borda bg-superficie px-3 py-1 text-xs text-texto-2 hover:border-borda-forte hover:text-texto">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5">
            {falas.map((f, i) => (
              <li key={i} className={cx('flex flex-col gap-1', f.de === 'cliente' ? 'items-end' : 'items-start')}>
                <div
                  className={cx(
                    'entrar max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed',
                    f.de === 'cliente' ? 'rounded-br-md bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]' : 'rounded-bl-md border border-borda bg-superficie text-texto',
                  )}
                >
                  {f.texto}
                </div>
                {f.extra}
              </li>
            ))}
            {pensando && (
              <li className="flex items-center gap-1 px-2 py-2" role="status" aria-label="IA digitando">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-atendimento" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </li>
            )}
          </ol>
        )}
        <div ref={fim} />
      </div>
      <form
        className="flex items-center gap-2 border-t border-borda p-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          void enviar()
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Mensagem do cliente…"
          aria-label="Mensagem do cliente"
          className="h-10 min-w-0 flex-1 rounded-xl border border-borda bg-fundo px-3 text-sm text-texto placeholder:text-texto-3 focus:border-acento-1 focus:outline-none focus:ring-2 focus:ring-acento-1/20"
        />
        <Botao type="submit" className="size-10 !px-0" disabled={!texto.trim()} carregando={pensando} aria-label="Enviar" icone={<Send className="size-4" />} />
      </form>
    </Cartao>
  )
}
