'use client';

import Link from 'next/link';
import { MessageCircle, Mic, Sparkles, CalendarDays, Check, ChevronRight } from 'lucide-react';
import { Cartao, CabecalhoCartao, CorpoCartao, Selo } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import type { AbaContratavel } from '@/lib/tipos';

const ABAS: { id: AbaContratavel; nome: string; descricao: string; icone: typeof MessageCircle; cor: string }[] = [
  { id: 'atendimento', nome: 'Atendimento', descricao: 'IA no WhatsApp 24h, agenda e lembretes.', icone: MessageCircle, cor: 'var(--aba-atendimento)' },
  { id: 'coach', nome: 'Coach de Vendas', descricao: 'Nota e dicas para cada reunião de venda.', icone: Mic, cor: 'var(--aba-coach)' },
  { id: 'estudio', nome: 'Estúdio', descricao: 'Fotos, vídeos e posts com a sua marca.', icone: Sparkles, cor: 'var(--aba-estudio)' },
];

/** Placeholder: a sessão E (planos e cobrança) liga isto ao Asaas. */
export function Plano() {
  const { empresa } = useSessao();
  if (!empresa) return null;
  return (
    <div className="flex flex-col gap-5">
      <Cartao>
        <CabecalhoCartao titulo="Seu plano" descricao="Período de teste — a cobrança chega em breve." acao={<Selo tom="acento">Teste</Selo>} />
        <CorpoCartao className="grid gap-3 sm:grid-cols-3">
          {ABAS.map((a) => {
            const tem = empresa.plano.abas.includes(a.id);
            const Icone = a.icone;
            return (
              <div key={a.id} className="rounded-xl border border-borda p-4">
                <Icone className="size-5" style={{ color: a.cor }} aria-hidden />
                <p className="mt-3 text-sm font-medium">{a.nome}</p>
                <p className="mt-0.5 text-xs text-texto-3">{a.descricao}</p>
                <p className="mt-3 flex items-center gap-1.5 text-xs">{tem ? <><Check className="size-3.5 text-sucesso" /> Ativo</> : <span className="text-texto-3">Não contratado</span>}</p>
              </div>
            );
          })}
        </CorpoCartao>
      </Cartao>
      <Cartao>
        <CabecalhoCartao titulo="Créditos do Estúdio" descricao="Cada foto ou vídeo gerado usa créditos." />
        <CorpoCartao>
          <p className="numero text-4xl">{empresa.plano.creditos}</p>
          <p className="mt-1 text-sm text-texto-3">créditos disponíveis</p>
        </CorpoCartao>
      </Cartao>
    </div>
  );
}

export function Integracoes() {
  const itens = [
    { nome: 'WhatsApp', descricao: 'Conecte o número da empresa para a IA atender.', icone: MessageCircle, cor: 'var(--aba-atendimento)', href: '/configuracoes/whatsapp', status: 'Configurar' },
    { nome: 'Google Agenda', descricao: 'Sincronizar a agenda da Atena com o Google.', icone: CalendarDays, cor: 'var(--acento-1)', href: null, status: 'Em breve' },
  ];
  return (
    <div className="flex flex-col gap-3">
      {itens.map((i) => {
        const Icone = i.icone;
        const conteudo = (
          <Cartao className="flex items-center gap-4 p-4 transition-colors hover:border-borda-forte">
            <span className="flex size-10 items-center justify-center rounded-xl bg-superficie-2">
              <Icone className="size-5" style={{ color: i.cor }} aria-hidden />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">{i.nome}</p>
              <p className="text-xs text-texto-3">{i.descricao}</p>
            </div>
            {i.href ? <ChevronRight className="size-4 text-texto-3" aria-hidden /> : <Selo>{i.status}</Selo>}
          </Cartao>
        );
        return i.href ? <Link key={i.nome} href={i.href}>{conteudo}</Link> : <div key={i.nome}>{conteudo}</div>;
      })}
    </div>
  );
}
