'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Bot, Check, CheckCheck, CircleCheck, Clock, Hand, Image as IconeImagem, Info, Mic, Paperclip, RotateCcw, Send, Square, Undo2, UserRound, Zap } from 'lucide-react'
import { Avatar, Botao, Esqueleto, Folha, cx, useToast } from '@/app/ui'
import { useDados, useSessao } from '@/lib/sessao'
import { formatarTelefone } from '@/lib/ui/formato'
import { preencherMensagemRapida } from '@/lib/atendimento/treino'
import { duracaoCurta } from '@/lib/atendimento/tempo'
import type { Mensagem, MensagemRapida, Treino } from '@/lib/atendimento/tipos'
import { useConversa, type DetalheConversa } from './_lib/tempoReal'
import { FichaContato } from './FichaContato'

export function PainelConversa({ id, aoVoltar, agora }: { id: string; aoVoltar: () => void; agora: Date }) {
  const { api, sessao, empresa } = useSessao()
  const { avisar } = useToast()
  const { detalhe, mensagens, erro, recarregar } = useConversa(id)
  const [fichaAberta, setFichaAberta] = useState(false)
  const [agindo, setAgindo] = useState<string | null>(null)
  const fim = useRef<HTMLDivElement>(null)
  const podeAtender = sessao?.papel !== 'vendedor'

  const c = detalhe?.conversa
  const quantas = mensagens?.length ?? 0
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' })
  }, [quantas, c?.iaDigitando])

  // marca como lida ao abrir
  useEffect(() => {
    if (c && c.naoLidas > 0 && podeAtender) api(`/api/whatsapp/conversas/${encodeURIComponent(id)}`, { corpo: { acao: 'lida' } }).catch(() => undefined)
  }, [c?.naoLidas, id, api, podeAtender, c])

  async function acao(nome: 'assumir' | 'devolver' | 'resolver' | 'reabrir') {
    setAgindo(nome)
    try {
      await api(`/api/whatsapp/conversas/${encodeURIComponent(id)}`, { corpo: { acao: nome } })
      await recarregar()
      avisar(
        { assumir: 'Você assumiu. A IA fica quieta nesta conversa.', devolver: 'A IA voltou a responder.', resolver: 'Conversa resolvida.', reabrir: 'Conversa reaberta.' }[nome],
        'sucesso',
      )
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setAgindo(null)
    }
  }

  if (erro && !detalhe) return <div className="rounded-cartao border border-borda bg-superficie p-6 text-sm text-erro">{erro}</div>
  if (!detalhe || !c) {
    return (
      <div className="flex h-full flex-col gap-3 rounded-cartao border border-borda bg-superficie p-4">
        <Esqueleto className="h-10 w-48" />
        <Esqueleto className="h-16 w-2/3" />
        <Esqueleto className="ml-auto h-16 w-1/2" />
      </div>
    )
  }

  const nome = c.nomeContato || formatarTelefone(c.telefone)
  const fuso = empresa?.fuso ?? 'America/Sao_Paulo'

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-0 gap-4 md:h-full">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-cartao border border-borda bg-superficie">
        {/* Topo */}
        <div className="flex items-center gap-3 border-b border-borda px-3 py-2.5 sm:px-4">
          <button onClick={aoVoltar} className="-ml-1 rounded-lg p-1.5 text-texto-2 hover:bg-superficie-2 md:hidden" aria-label="Voltar para a lista">
            <ArrowLeft className="size-5" />
          </button>
          <button onClick={() => setFichaAberta(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left xl:pointer-events-none" aria-label="Ver ficha do contato">
            <Avatar nome={nome} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-texto">{nome}</p>
              <p className="truncate text-xs text-texto-3">
                {formatarTelefone(c.telefone)} · {c.modo === 'ia' ? 'IA respondendo' : 'Equipe no comando'}
              </p>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {podeAtender && c.status === 'aberta' && (
              <>
                {c.modo === 'ia' ? (
                  <Botao tamanho="p" icone={<Hand className="size-4" />} carregando={agindo === 'assumir'} onClick={() => acao('assumir')}>
                    <span className="hidden sm:inline">Assumir</span>
                  </Botao>
                ) : (
                  <Botao variante="secundario" tamanho="p" icone={<Bot className="size-4" />} carregando={agindo === 'devolver'} onClick={() => acao('devolver')}>
                    <span className="hidden sm:inline">Devolver pra IA</span>
                  </Botao>
                )}
                <Botao variante="fantasma" tamanho="p" icone={<CircleCheck className="size-4" />} carregando={agindo === 'resolver'} onClick={() => acao('resolver')} aria-label="Resolver">
                  <span className="hidden lg:inline">Resolver</span>
                </Botao>
              </>
            )}
            {podeAtender && c.status === 'resolvida' && (
              <Botao variante="secundario" tamanho="p" icone={<RotateCcw className="size-4" />} carregando={agindo === 'reabrir'} onClick={() => acao('reabrir')}>
                Reabrir
              </Botao>
            )}
            <button onClick={() => setFichaAberta(true)} className="rounded-lg p-1.5 text-texto-2 hover:bg-superficie-2 xl:hidden" aria-label="Ficha do contato">
              <Info className="size-5" />
            </button>
          </div>
        </div>

        {c.precisaHumano && (
          <div className="flex items-center gap-2 border-b border-atencao/20 bg-atencao/10 px-4 py-2 text-[13px] text-atencao">
            <Hand className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <strong className="font-semibold">Precisa de alguém da equipe</strong>
              {c.motivoHumano ? ` · ${c.motivoHumano}` : ''}
              {c.aguardandoDesde ? ` · esperando há ${duracaoCurta(agora.getTime() - Date.parse(c.aguardandoDesde))}` : ''}
            </span>
          </div>
        )}

        {/* Mensagens */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
          <Baloes mensagens={mensagens ?? []} fuso={fuso} />
          {c.iaDigitando && <Digitando />}
          <div ref={fim} />
        </div>

        {podeAtender && <Compositor detalhe={detalhe} aoEnviar={recarregar} />}
      </div>

      <aside className="hidden w-[300px] shrink-0 overflow-y-auto rounded-cartao border border-borda bg-superficie xl:block" aria-label="Ficha do contato">
        <FichaContato detalhe={detalhe} fuso={fuso} />
      </aside>
      <Folha aberto={fichaAberta} aoFechar={() => setFichaAberta(false)} titulo={nome}>
        <FichaContato detalhe={detalhe} fuso={fuso} semCabecalho />
      </Folha>
    </div>
  )
}

function hora(iso: string, fuso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}
function dia(iso: string, fuso: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(iso))
}

function Baloes({ mensagens, fuso }: { mensagens: Mensagem[]; fuso: string }) {
  let diaAnterior = ''
  return (
    <ol className="flex flex-col gap-1.5">
      {mensagens.map((m, i) => {
        const d = dia(m.em, fuso)
        const mostraDia = d !== diaAnterior
        diaAnterior = d
        const deCliente = m.de === 'cliente'
        const mesmoAutorAntes = i > 0 && mensagens[i - 1].de === m.de && !mostraDia
        return (
          <li key={m.id} className="flex flex-col">
            {mostraDia && (
              <span className="mx-auto my-3 rounded-full bg-superficie-2 px-3 py-1 text-[11px] font-medium text-texto-3 first-letter:uppercase">{d}</span>
            )}
            {!mesmoAutorAntes && !deCliente && (
              <span className={cx('mb-0.5 mt-2 flex items-center gap-1 self-end text-[11px] text-texto-3')}>
                {m.de === 'ia' ? <Bot className="size-3 text-atendimento" aria-hidden /> : <UserRound className="size-3" aria-hidden />}
                {m.de === 'ia' ? 'IA' : m.de === 'equipe' ? 'Equipe' : 'Sistema'}
                {m.tipo === 'modelo' && ' · modelo aprovado'}
              </span>
            )}
            <div
              className={cx(
                'entrar max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed sm:max-w-[70%]',
                deCliente && 'self-start rounded-bl-md bg-superficie-2 text-texto',
                m.de === 'ia' && 'self-end rounded-br-md border border-atendimento/20 bg-atendimento/10 text-texto',
                m.de === 'equipe' && 'gradiente-atena self-end rounded-br-md text-white',
                m.de === 'sistema' && 'self-center bg-transparent text-xs text-texto-3',
                mesmoAutorAntes ? 'mt-0' : deCliente ? 'mt-2' : '',
              )}
            >
              {m.tipo === 'imagem' && <span className="mb-1 flex items-center gap-1.5 text-xs opacity-80"><IconeImagem className="size-3.5" aria-hidden /> Foto</span>}
              {m.tipo === 'audio' && <span className="mb-1 flex items-center gap-1.5 text-xs opacity-80"><Mic className="size-3.5" aria-hidden /> Áudio</span>}
              {m.midiaId && deCliente && m.tipo === 'imagem' && (
                <MidiaRecebida id={m.midiaId} tipo="imagem" />
              )}
              {m.midiaId && deCliente && m.tipo === 'audio' && <MidiaRecebida id={m.midiaId} tipo="audio" />}
              {m.texto || (m.tipo === 'audio' ? <span className="italic opacity-70">sem transcrição</span> : null)}
              <span className={cx('ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px]', m.de === 'equipe' ? 'text-white/70' : 'text-texto-3')}>
                {hora(m.em, fuso)}
                {!deCliente && <StatusEnvio status={m.status} />}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function StatusEnvio({ status }: { status?: Mensagem['status'] }) {
  if (status === 'lida') return <CheckCheck className="size-3 text-sky-400" aria-label="Lida" />
  if (status === 'entregue') return <CheckCheck className="size-3" aria-label="Entregue" />
  if (status === 'falhou') return <span className="text-erro">falhou</span>
  if (status === 'enviando') return <Clock className="size-3" aria-label="Enviando" />
  return <Check className="size-3" aria-label="Enviada" />
}

function MidiaRecebida({ id, tipo }: { id: string; tipo: 'imagem' | 'audio' }) {
  const { api } = useSessao()
  const [url, setUrl] = useState<string | null>(null)
  const [falhou, setFalhou] = useState(false)
  useEffect(() => {
    let vivo = true
    let criada: string | null = null
    // busca com o token da sessão e mostra como blob
    ;(async () => {
      try {
        const { tokenAtual } = await import('@/lib/auth/cliente')
        const token = await tokenAtual()
        const r = await fetch(`/api/whatsapp/midia/${encodeURIComponent(id)}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
        if (!r.ok) throw new Error()
        criada = URL.createObjectURL(await r.blob())
        if (vivo) setUrl(criada)
      } catch {
        if (vivo) setFalhou(true)
      }
    })()
    return () => {
      vivo = false
      if (criada) URL.revokeObjectURL(criada)
    }
  }, [id, api])
  if (falhou) return null
  if (!url) return <Esqueleto className="mb-1 h-24 w-40 rounded-lg" />
  // eslint-disable-next-line @next/next/no-img-element
  if (tipo === 'imagem') return <img src={url} alt="Foto enviada pelo cliente" className="mb-1 max-h-64 rounded-lg" />
  return <audio src={url} controls className="mb-1 h-9 max-w-full" />
}

function Digitando() {
  return (
    <div className="mt-3 flex justify-end" role="status" aria-label="IA digitando">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-br-md border border-atendimento/20 bg-atendimento/10 px-3.5 py-2.5">
        <Bot className="size-3.5 text-atendimento" aria-hidden />
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1.5 animate-bounce rounded-full bg-atendimento" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  )
}

function Compositor({ detalhe, aoEnviar }: { detalhe: DetalheConversa; aoEnviar: () => Promise<void> }) {
  const { api, empresa } = useSessao()
  const { avisar } = useToast()
  const { dados: treino } = useDados<{ treino: Treino }>('/api/whatsapp/treino')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [gravando, setGravando] = useState<MediaRecorder | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const c = detalhe.conversa
  const janelaFechada = !detalhe.janela.aberta
  const bloqueado = janelaFechada && !detalhe.temModeloRetomada

  const rapidas: MensagemRapida[] = useMemo(() => treino?.treino.mensagensRapidas ?? [], [treino])
  const busca = texto.startsWith('/') ? texto.slice(1).toLowerCase() : null
  const sugestoes = busca !== null ? rapidas.filter((r) => r.atalho.startsWith(busca)).slice(0, 6) : []
  const podeGravar = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/ogg;codecs=opus')

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [texto])

  function usarRapida(r: MensagemRapida) {
    setTexto(preencherMensagemRapida(r.texto, { endereco: empresa?.endereco, telefone: empresa?.telefone, empresa: empresa?.nome, nome: c.nomeContato.split(' ')[0] }))
    area.current?.focus()
  }

  async function enviar() {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    try {
      await api(`/api/whatsapp/conversas/${encodeURIComponent(c.id)}`, { corpo: { texto: t } })
      setTexto('')
      await aoEnviar()
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  async function enviarArquivo(f: File | Blob, nome = 'arquivo') {
    setEnviando(true)
    try {
      const form = new FormData()
      form.append('arquivo', f, (f as File).name ?? nome)
      if (texto.trim() && f.type.startsWith('image/')) form.append('legenda', texto.trim())
      await api(`/api/whatsapp/conversas/${encodeURIComponent(c.id)}/midia`, { formulario: form })
      if (f.type.startsWith('image/')) setTexto('')
      await aoEnviar()
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setEnviando(false)
    }
  }

  async function alternarGravacao() {
    if (gravando) {
      gravando.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream, { mimeType: 'audio/ogg;codecs=opus' })
      const partes: Blob[] = []
      rec.ondataavailable = (e) => partes.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        setGravando(null)
        void enviarArquivo(new Blob(partes, { type: 'audio/ogg' }), 'audio.ogg')
      }
      rec.start()
      setGravando(rec)
    } catch {
      avisar('Não consegui usar o microfone.', 'erro')
    }
  }

  return (
    <div className="border-t border-borda p-2.5 sm:p-3">
      {janelaFechada && (
        <p className="mb-2 flex items-start gap-2 rounded-lg bg-superficie-2 px-3 py-2 text-xs text-texto-2">
          <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {bloqueado ? (
            <span>
              Passaram 24h desde a última mensagem do cliente. Pela regra da Meta, agora só dá pra mandar um modelo aprovado.{' '}
              <Link href="/atendimento/conexao" className="font-medium text-acento underline-offset-2 hover:underline">
                Cadastrar modelo
              </Link>
            </span>
          ) : (
            <span>Janela de 24h fechada: sua mensagem vai dentro do modelo aprovado de retomada (só texto).</span>
          )}
        </p>
      )}
      {sugestoes.length > 0 && (
        <ul className="mb-2 flex flex-col overflow-hidden rounded-xl border border-borda" role="listbox" aria-label="Mensagens rápidas">
          {sugestoes.map((r) => (
            <li key={r.atalho}>
              <button role="option" aria-selected={false} onClick={() => usarRapida(r)} className="flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm hover:bg-superficie-2">
                <span className="numero shrink-0 text-xs text-atendimento">/{r.atalho}</span>
                <span className="truncate text-texto-2">{r.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-1.5">
        <input
          ref={arquivo}
          type="file"
          accept="image/jpeg,image/png,audio/ogg,audio/mpeg,audio/mp4,audio/aac"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void enviarArquivo(f)
          }}
        />
        <button
          onClick={() => arquivo.current?.click()}
          disabled={janelaFechada || enviando}
          className="mb-1 rounded-lg p-2 text-texto-2 hover:bg-superficie-2 disabled:opacity-40"
          aria-label="Enviar foto ou áudio"
        >
          <Paperclip className="size-5" />
        </button>
        {rapidas.length > 0 && (
          <button onClick={() => (setTexto('/'), area.current?.focus())} className="mb-1 hidden rounded-lg p-2 text-texto-2 hover:bg-superficie-2 sm:block" aria-label="Mensagens rápidas" title="Mensagens rápidas (digite /)">
            <Zap className="size-5" />
          </button>
        )}
        <textarea
          ref={area}
          rows={1}
          value={texto}
          disabled={bloqueado}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (sugestoes.length && busca !== null) usarRapida(sugestoes[0])
              else void enviar()
            }
          }}
          placeholder={c.modo === 'ia' ? 'Escreva pra assumir e responder… (/ = mensagens rápidas)' : 'Escreva sua resposta… (/ = mensagens rápidas)'}
          aria-label="Mensagem"
          className="min-h-10 flex-1 resize-none rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm text-texto placeholder:text-texto-3 focus:border-acento-1 focus:outline-none focus:ring-2 focus:ring-acento-1/20 disabled:opacity-50"
        />
        {!texto.trim() && podeGravar && !janelaFechada ? (
          <Botao
            variante={gravando ? 'perigo' : 'secundario'}
            className="mb-0.5 size-10 !px-0"
            onClick={alternarGravacao}
            aria-label={gravando ? 'Parar e enviar áudio' : 'Gravar áudio'}
            icone={gravando ? <Square className="size-4" /> : <Mic className="size-4" />}
          />
        ) : (
          <Botao className="mb-0.5 size-10 !px-0" onClick={enviar} carregando={enviando} disabled={!texto.trim() || bloqueado} aria-label="Enviar" icone={<Send className="size-4" />} />
        )}
      </div>
      {c.modo === 'ia' && texto.trim() && (
        <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-texto-3">
          <Undo2 className="size-3" aria-hidden /> Ao enviar, você assume a conversa e a IA pausa aqui.
        </p>
      )}
    </div>
  )
}

