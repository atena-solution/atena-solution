'use client';
// Tela de quando a aba não está no plano: convida a contratar (não é erro).
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Cartao, ICONES_NAV, cx } from '@/app/ui';
import { CONFIG_PLANOS } from '@/lib/planos/config';
import { formatarReais, obterPlano } from '@/lib/planos/preco';
import type { AbaContratavel } from '@/lib/tipos';

const TEXTO: Record<AbaContratavel, { titulo: string; frase: string }> = {
  atendimento: { titulo: 'Atenda todo cliente na hora, 24h', frase: 'Uma atendente de IA no seu WhatsApp que tira dúvidas, marca na agenda, lembra e recupera quem faltou.' },
  coach: { titulo: 'Cada reunião de venda vira nota e dica', frase: 'Grave a conversa, receba a nota do vendedor contra o seu roteiro, as objeções e o follow-up pronto.' },
  estudio: { titulo: 'Foto do celular vira foto de catálogo', frase: 'Fotos profissionais, posts e vídeos curtos com a sua marca, em minutos.' },
};

export function ConviteAba({ aba, podeContratar }: { aba: AbaContratavel; podeContratar: boolean }) {
  const plano = obterPlano(aba);
  const pacote = obterPlano(CONFIG_PLANOS.planoDoTeste);
  const Icone = ICONES_NAV[aba];
  const t = TEXTO[aba];
  return (
    <div className="mx-auto max-w-2xl py-6 md:py-12">
      <Cartao className="overflow-hidden">
        <div className="border-b border-borda px-6 py-8 text-center md:px-10" style={{ background: `color-mix(in oklab, var(--aba-${aba}) 8%, transparent)` }}>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-borda bg-superficie" style={{ color: `var(--aba-${aba})` }}>
            <Icone className="size-5" aria-hidden />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-texto-3">{plano?.nome ?? aba} · fora do seu plano</p>
          <h1 className="titulo-serif mt-2 text-3xl text-texto md:text-4xl">{t.titulo}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-texto-2">{t.frase}</p>
        </div>
        <div className="grid gap-6 px-6 py-6 md:grid-cols-[1fr_auto] md:items-end md:px-10">
          <ul className="space-y-2">
            {(plano?.destaques ?? []).map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-texto">
                <Check className="mt-0.5 size-4 shrink-0 text-sucesso" aria-hidden /> {d}
              </li>
            ))}
          </ul>
          <div className="md:text-right">
            {plano && (
              <p className="text-sm text-texto-2">
                a partir de <span className="numero text-xl font-semibold text-texto">{formatarReais(plano.precoMensal, { semCentavosQuandoInteiro: true })}</span>/mês
              </p>
            )}
            {pacote && <p className="mt-1 text-xs text-texto-3">ou tudo junto no {pacote.nome} por {formatarReais(pacote.precoMensal, { semCentavosQuandoInteiro: true })}/mês</p>}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-borda px-6 py-5 sm:flex-row sm:justify-end md:px-10">
          <Link href="/precos" className={cx('inline-flex h-10 items-center justify-center rounded-[10px] border border-borda px-4 text-sm font-medium text-texto hover:bg-superficie-2')}>
            Comparar planos
          </Link>
          {podeContratar ? (
            <Link href="/plano" className="gradiente-atena inline-flex h-10 items-center justify-center rounded-[10px] px-4 text-sm font-medium text-white hover:brightness-110">
              Adicionar ao meu plano
            </Link>
          ) : (
            <p className="self-center text-sm text-texto-2">Peça ao dono da conta para adicionar.</p>
          )}
        </div>
      </Cartao>
    </div>
  );
}
