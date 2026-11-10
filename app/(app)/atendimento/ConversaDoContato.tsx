'use client'
// Conversa do WhatsApp (Atendimento) dentro da ficha do contato: últimas mensagens e atalho para a caixa de entrada.

import Link from 'next/link'
import { ArrowRight, Bot, MessageCircle } from 'lucide-react'
import { Cartao, CabecalhoCartao, CorpoCartao, Esqueleto, Selo, cx } from '@/app/ui'
import { useDados } from '@/lib/sessao'
import { tempoRelativo } from '@/lib/ui/formato'
import type { Conversa, Mensagem } from '@/lib/atendimento/tipos'

export function ConversaDoContato({ contatoId, telefone }: { contatoId: string; telefone: string }) {
  const { dados: resposta, erro: falhou } = useDados<{ conversa: Conversa | null; mensagens: Mensagem[] }>(`/api/whatsapp/conversas/contato/${encodeURIComponent(contatoId)}`)
  // sem conversa ainda = mesmo caminho do erro (mostra o convite para chamar no WhatsApp)
  const dados = resposta?.conversa ? { conversa: resposta.conversa, mensagens: resposta.mensagens } : null
  const erro = falhou || (resposta && !resposta.conversa)
  const id = dados?.conversa.id ?? ''
  const ultimas = (dados?.mensagens ?? []).slice(-4)
  return (
    <Cartao>
      <CabecalhoCartao
        icone={<MessageCircle className="text-atendimento" />}
        titulo="Conversa no WhatsApp"
        descricao={dados ? (dados.conversa.modo === 'humano' ? 'Com a equipe' : 'Com a IA') : undefined}
        acao={
          dados ? (
            <Link href={`/atendimento?c=${encodeURIComponent(id)}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-acento hover:underline">
              Abrir <ArrowRight className="size-3.5" />
            </Link>
          ) : undefined
        }
      />
      <CorpoCartao className="flex flex-col gap-2">
        {erro ? (
          <p className="text-sm text-texto-2">
            Ainda não conversou pelo WhatsApp da empresa.{' '}
            <a href={`https://wa.me/${telefone}`} target="_blank" rel="noreferrer" className="font-medium text-acento hover:underline">Chamar no WhatsApp</a>
          </p>
        ) : !dados ? (
          <Esqueleto className="h-20 w-full" />
        ) : ultimas.length === 0 ? (
          <p className="text-sm text-texto-2">Sem mensagens ainda.</p>
        ) : (
          <>
            {dados.conversa.precisaHumano && <Selo tom="atencao" ponto className="self-start">Esperando a equipe</Selo>}
            <ol className="flex flex-col gap-1.5">
              {ultimas.map((m) => (
                <li key={m.id} className={cx('flex', m.de === 'cliente' ? 'justify-start' : 'justify-end')}>
                  <div className={cx('max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px]', m.de === 'cliente' ? 'rounded-bl-md bg-superficie-2 text-texto' : 'rounded-br-md bg-atendimento/10 text-texto')}>
                    <p className="line-clamp-3 whitespace-pre-wrap break-words">{m.texto || (m.tipo === 'audio' ? '🎤 Áudio' : m.tipo === 'imagem' ? '📷 Foto' : '')}</p>
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-texto-3">
                      {m.de === 'ia' && <Bot className="size-3" aria-label="IA" />}
                      {tempoRelativo(m.em)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </CorpoCartao>
    </Cartao>
  )
}
