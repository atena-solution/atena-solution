'use client'

import { Bot, Hand, UserRound } from 'lucide-react'
import { Avatar, cx } from '@/app/ui'
import { seloSemResposta } from '@/lib/atendimento/caixa'
import { formatarTelefone, tempoRelativo } from '@/lib/ui/formato'
import type { Conversa } from '@/lib/atendimento/tipos'

const COR_SELO = { ok: 'text-texto-3', atencao: 'text-atencao bg-atencao/10', urgente: 'text-erro bg-erro/10' } as const

export function ItemConversa({ conversa: c, agora, ativa, aoAbrir }: { conversa: Conversa; agora: Date; ativa: boolean; aoAbrir: () => void }) {
  const selo = seloSemResposta(c.aguardandoDesde, agora)
  const nome = c.nomeContato || formatarTelefone(c.telefone)
  return (
    <button
      onClick={aoAbrir}
      aria-current={ativa || undefined}
      className={cx(
        'group relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
        ativa ? 'bg-superficie-2' : 'hover:bg-superficie-2/60',
      )}
    >
      {c.precisaHumano && <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-atencao" />}
      <Avatar nome={nome} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cx('truncate text-sm text-texto', c.naoLidas > 0 ? 'font-semibold' : 'font-medium')}>{nome}</span>
          <span className="shrink-0 text-[11px] text-texto-3">{c.ultimaMensagem.em ? tempoRelativo(c.ultimaMensagem.em, agora) : ''}</span>
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-texto-2">
          {c.iaDigitando ? (
            <span className="text-atendimento">IA digitando…</span>
          ) : (
            <>
              {c.ultimaMensagem.de === 'ia' && <Bot className="size-3.5 shrink-0 text-atendimento" aria-label="IA" />}
              {c.ultimaMensagem.de === 'equipe' && <UserRound className="size-3.5 shrink-0 text-texto-3" aria-label="Equipe" />}
              <span className="truncate">{c.ultimaMensagem.texto || '…'}</span>
            </>
          )}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {c.precisaHumano && (
            <span className="inline-flex items-center gap-1 rounded-full bg-atencao/10 px-2 py-0.5 text-[11px] font-medium text-atencao">
              <Hand className="size-3" aria-hidden /> {c.motivoHumano || 'Precisa de humano'}
            </span>
          )}
          {!c.precisaHumano && c.modo === 'humano' && c.status === 'aberta' && (
            <span className="rounded-full bg-superficie-2 px-2 py-0.5 text-[11px] font-medium text-texto-2">Equipe</span>
          )}
          {selo && c.status === 'aberta' && (
            <span className={cx('numero rounded-full px-2 py-0.5 text-[11px]', COR_SELO[selo.nivel])} title="Tempo sem resposta">
              {selo.texto === 'agora' ? 'agora' : `há ${selo.texto}`}
            </span>
          )}
          {c.naoLidas > 0 && (
            <span className="numero ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-atendimento px-1.5 text-[11px] text-white">
              {c.naoLidas}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
