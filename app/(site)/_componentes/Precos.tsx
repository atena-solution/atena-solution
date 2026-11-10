'use client';
import Link from 'next/link';
import { useState } from 'react';
import { CONFIG_PLANOS } from '@/lib/planos/config';
import { calcularPreco, economiaDoPacote, formatarReais, listarPlanos, planoTemVendedores, type Ciclo } from '@/lib/planos/preco';
import { IcoCheck } from './Icones';

const r = (c: number) => formatarReais(c, { semCentavosQuandoInteiro: true });

export function Precos({ destacar }: { destacar?: string }) {
  const [ciclo, setCiclo] = useState<Ciclo>('mensal');
  const [vendedores, setVendedores] = useState(3);
  const planos = listarPlanos();
  const economia = economiaDoPacote(vendedores);

  return (
    <div>
      <div className="flex flex-col items-center gap-4">
        {CONFIG_PLANOS.descontoAnualPct > 0 && (
          <div className="s-alternador" role="group" aria-label="Ciclo de cobrança">
            <button type="button" aria-pressed={ciclo === 'mensal'} onClick={() => setCiclo('mensal')}>Mensal</button>
            <button type="button" aria-pressed={ciclo === 'anual'} onClick={() => setCiclo('anual')}>
              Anual <span style={{ color: 'var(--s-verde)' }}>−{CONFIG_PLANOS.descontoAnualPct}%</span>
            </button>
          </div>
        )}
        <label className="flex items-center gap-3 text-sm s-texto-2">
          Vendedores no Coach:
          <input type="number" min={1} max={CONFIG_PLANOS.maxVendedores} value={vendedores}
            onChange={(e) => setVendedores(Math.max(1, Math.min(CONFIG_PLANOS.maxVendedores, Number(e.target.value) || 1)))}
            className="w-20 rounded-lg px-2 py-1.5 text-center s-mono" style={{ border: '1px solid var(--s-borda-forte)', background: 'var(--s-superficie)', color: 'var(--s-texto)' }} />
        </label>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {planos.map((p) => {
          const o = calcularPreco({ planoId: p.id, vendedores, ciclo });
          const destaque = destacar ? destacar === p.id : p.maisEscolhido;
          return (
            <div key={p.id} className={`s-card flex flex-col p-6 ${destaque ? 's-plano-destaque s-card-sombra' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="s-titulo-m">{p.nome}</h3>
                {destaque && <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--s-degrade)' }}>{destacar ? 'Indicado' : 'Mais escolhido'}</span>}
              </div>
              <p className="s-texto-2 mt-2 text-sm min-h-[40px]">{p.chamada}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">{r(o.equivalenteMensal)}</span>
                <span className="s-texto-3 text-sm">/mês</span>
              </p>
              <p className="s-texto-3 mt-1 min-h-[36px] text-xs leading-relaxed">
                {ciclo === 'anual' ? `${r(o.valorCobrado)} por ano · economia de ${r(o.economiaAnual)}` : 'cobrado todo mês'}
                {planoTemVendedores(p) && <><br />{o.vendedores} vendedor{o.vendedores > 1 ? 'es' : ''}{p.vendedoresInclusos ? ` (${p.vendedoresInclusos} incluso${p.vendedoresInclusos > 1 ? 's' : ''})` : ''}</>}
              </p>
              <Link href={`/cadastro?plano=${p.id}`} className={`s-btn mt-5 w-full ${destaque ? 's-btn-primario' : 's-btn-secundario'}`}>Testar {CONFIG_PLANOS.testeGratisDias} dias grátis</Link>
              <ul className="mt-6 grid gap-2.5 text-sm">
                {p.destaques.map((d) => <li key={d} className="flex gap-2.5"><IcoCheck className="s-check" />{d}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
      {economia > 0 && (
        <p className="s-texto-2 mt-6 text-center text-sm">
          No Pacote completo você economiza <strong style={{ color: 'var(--s-texto)' }}>{r(economia)} por mês</strong> em relação a contratar as três abas separadas.
        </p>
      )}
    </div>
  );
}
