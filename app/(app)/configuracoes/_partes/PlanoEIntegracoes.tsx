'use client';

import Link from 'next/link';
import { MessageCircle, Mic, Sparkles, CalendarDays, Check, ChevronRight } from 'lucide-react';
import { Cartao, CabecalhoCartao, CorpoCartao, Selo } from '@/app/ui';
import { PainelPlano } from '../../plano/PainelPlano';
import type { AbaContratavel } from '@/lib/tipos';

const ABAS: { id: AbaContratavel; nome: string; descricao: string; icone: typeof MessageCircle; cor: string }[] = [
  { id: 'atendimento', nome: 'Atendimento', descricao: 'IA no WhatsApp 24h, agenda e lembretes.', icone: MessageCircle, cor: 'var(--aba-atendimento)' },
  { id: 'coach', nome: 'Coach de Vendas', descricao: 'Nota e dicas para cada reunião de venda.', icone: Mic, cor: 'var(--aba-coach)' },
  { id: 'estudio', nome: 'Estúdio', descricao: 'Fotos, vídeos e posts com a sua marca.', icone: Sparkles, cor: 'var(--aba-estudio)' },
];

/** Plano e créditos — tela da sessão E (app/(app)/plano), ligada ao Asaas. */
export function Plano() {
  return <PainelPlano embutido />;
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
