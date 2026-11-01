'use client'

import Link from 'next/link'
import { Bot, CalendarDays, ExternalLink, StickyNote } from 'lucide-react'
import { Avatar, Selo } from '@/app/ui'
import { formatarTelefone, tempoRelativo } from '@/lib/ui/formato'
import { etapasDaEmpresa } from '@/lib/contatos/funil'
import { NOME_STATUS, TOM_STATUS } from '@/lib/agenda/horarios'
import { useSessao } from '@/lib/sessao'
import type { DetalheConversa } from './_lib/tempoReal'

export function FichaContato({ detalhe, fuso, semCabecalho }: { detalhe: DetalheConversa; fuso: string; semCabecalho?: boolean }) {
  const { empresa } = useSessao()
  const ct = detalhe.contato
  const etapa = etapasDaEmpresa(empresa?.etapas).find((e) => e.id === ct?.etapa)
  const nome = ct?.nome || detalhe.conversa.nomeContato || formatarTelefone(detalhe.conversa.telefone)
  const quando = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: fuso, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  const servico = (id: string) => detalhe.servicos.find((s) => s.id === id)?.nome ?? 'Serviço'
  const prof = (id: string) => detalhe.profissionais.find((p) => p.id === id)?.nome

  return (
    <div className="flex flex-col gap-5 p-4">
      {!semCabecalho && (
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <Avatar nome={nome} tamanho="g" />
          <div>
            <p className="font-semibold text-texto">{nome}</p>
            <p className="numero text-xs text-texto-3">{formatarTelefone(detalhe.conversa.telefone)}</p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-1.5">
        {etapa && (
          <Selo ponto>
            <span style={{ color: etapa.cor }}>{etapa.nome}</span>
          </Selo>
        )}
        {ct?.origem && <Selo>{ct.origem}</Selo>}
        {ct?.etiquetas.map((e) => (
          <Selo key={e} tom="acento">
            {e}
          </Selo>
        ))}
      </div>
      {ct && (
        <Link href={`/contatos/${encodeURIComponent(ct.id)}`} className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-acento hover:underline">
          Abrir ficha completa <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      )}

      {ct && Object.keys(ct.campos ?? {}).length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
          {Object.entries(ct.campos).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="capitalize text-texto-3">{k}</dt>
              <dd className="truncate text-texto">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-texto-3">
          <CalendarDays className="size-3.5" aria-hidden /> Agendamentos
        </h4>
        {detalhe.agendamentos.length === 0 ? (
          <p className="text-[13px] text-texto-3">Nenhum ainda. A IA marca sozinha quando o cliente pedir.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detalhe.agendamentos.slice(0, 5).map((a) => (
              <li key={a.id} className="rounded-xl border border-borda p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-texto">{servico(a.servicoId)}</span>
                  <Selo tom={TOM_STATUS[a.status]}>{NOME_STATUS[a.status]}</Selo>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-texto-2">
                  {quando(a.inicio)}
                  {prof(a.profissionalId) ? ` · ${prof(a.profissionalId)}` : ''}
                  {a.criadoPor === 'ia' && <Bot className="ml-1 size-3 text-atendimento" aria-label="Marcado pela IA" />}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-texto-3">
          <StickyNote className="size-3.5" aria-hidden /> Linha do tempo
        </h4>
        {detalhe.atividades.length === 0 ? (
          <p className="text-[13px] text-texto-3">Sem registros.</p>
        ) : (
          <ol className="flex flex-col gap-2 border-l border-borda pl-3">
            {detalhe.atividades.slice(0, 8).map((a) => (
              <li key={a.id} className="text-[13px]">
                <p className="text-texto">{a.resumo}</p>
                <p className="text-[11px] text-texto-3">
                  {tempoRelativo(a.quando)}
                  {a.porIA ? ' · IA' : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
