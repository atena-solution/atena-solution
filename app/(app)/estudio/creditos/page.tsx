'use client';
import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Coins, RotateCcw } from 'lucide-react';
import { ROTULO_TIPO } from '@/lib/estudio/creditos';
import type { LancamentoCredito, TipoCriacao } from '@/lib/estudio/tipos';
import { chamar } from '../_componentes/cliente';
import { Cartao, Titulo, Vazio, cx } from '../_componentes/ui';

interface Dados { saldo: number; custos: Record<TipoCriacao, number>; gasto: number; recarregado: number; extrato: LancamentoCredito[] }

export default function CreditosPage() {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => { chamar<Dados>('/api/estudio/creditos').then(setD).catch(() => {}); }, []);

  return (
    <>
      <Titulo titulo="Créditos" descricao="Cada criação usa créditos. O valor sai antes de gerar e volta na hora se algo falhar." />
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <Cartao className="p-5 md:col-span-1 bg-[linear-gradient(135deg,var(--e-acento-fraco),transparent)]">
          <div className="text-sm text-[var(--e-suave)] flex items-center gap-2"><Coins className="size-4 text-[var(--e-acento)]" aria-hidden />Saldo</div>
          <div className="text-4xl e-mono mt-2">{d?.saldo ?? '—'}</div>
          <p className="text-xs text-[var(--e-suave)] mt-2">Recarga e plano ficam em Configurações → Plano.</p>
        </Cartao>
        <Cartao className="p-5 md:col-span-2">
          <div className="text-sm font-medium mb-3">Quanto custa</div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {d && (['foto', 'post', 'video', 'slideshow', 'calendario'] as TipoCriacao[]).map((t) => (
              <li key={t} className="rounded-[10px] bg-[var(--e-cartao-2)] px-3 py-2">
                <div className="text-xs text-[var(--e-suave)]">{ROTULO_TIPO[t]}</div>
                <div className="e-mono text-sm">{d.custos[t] === 0 ? 'grátis' : `${d.custos[t]} / un.`}</div>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
      <Cartao>
        <div className="px-5 h-12 flex items-center justify-between border-b border-[var(--e-borda)]">
          <span className="text-sm font-medium">Extrato</span>
          {d && <span className="text-xs text-[var(--e-suave)]">Gasto líquido: <span className="e-mono">{d.gasto}</span></span>}
        </div>
        {!d ? (
          <div className="p-5 space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-10 rounded-[10px] e-esqueleto" />)}</div>
        ) : d.extrato.length === 0 ? (
          <Vazio icone={<Coins className="size-5" />} titulo="Sem movimentos" texto="Quando você gerar algo, o débito aparece aqui." />
        ) : (
          <ul className="divide-y divide-[var(--e-borda)]">
            {d.extrato.map((l) => {
              const Icone = l.tipo === 'debito' ? ArrowUpRight : l.tipo === 'devolucao' ? RotateCcw : ArrowDownLeft;
              return (
                <li key={l.id} className="px-5 py-3 flex items-center gap-3">
                  <span className={cx('size-8 rounded-full grid place-items-center', l.tipo === 'debito' ? 'bg-[var(--e-cartao-2)] text-[var(--e-suave)]' : 'bg-sucesso/10 text-sucesso')}><Icone className="size-4" aria-hidden /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{l.motivo}</div>
                    <div className="text-xs text-[var(--e-suave)]">{new Date(l.quando).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div className={cx('e-mono text-sm', l.tipo === 'debito' ? '' : 'text-sucesso')}>{l.tipo === 'debito' ? '−' : '+'}{l.valor}</div>
                  <div className="e-mono text-xs text-[var(--e-suave)] w-12 text-right">{l.saldoDepois}</div>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </>
  );
}
