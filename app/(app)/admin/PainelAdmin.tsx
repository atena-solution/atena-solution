'use client';
// Painel interno da Atena: todas as empresas, plano, receita, custo de IA, créditos e saúde.
import { useMemo, useState } from 'react';
import { ShieldCheck, AlertTriangle, Search } from 'lucide-react';
import { Cabecalho, Cartao, CabecalhoCartao, CorpoCartao, Selo, Esqueleto, Vazio, cx, type TomSelo } from '@/app/ui';
import { useDados } from '@/lib/sessao';
import type { Fase } from '@/lib/planos/acesso';
import type { Semaforo } from '@/lib/planos/admin';
import { formatarReais } from '@/lib/planos/preco';
import { formatarDataBR } from '@/lib/planos/datas';

interface Linha {
  id: string; nome: string; segmento: string; criadoEm: string; membros: number;
  planoId: string | null; fase: Fase; liberadoAte: string | null; abas: string[];
  creditos: number; receitaMensal: number; custoIA: number; modelosSemPreco: string[];
  margem: { valor: number; pct: number };
  saude: { cor: Semaforo; motivos: string[] };
}
interface Resposta {
  mes: string;
  totais: { empresas: number; pagantes: number; emTeste: number; vencidas: number; mrr: number; custoIA: number };
  empresas: Linha[];
  alertas: { empresaId: string | null; pagamentoId?: string; motivo: string; quando: string }[];
}

const FASE: Record<Fase, { rotulo: string; tom: TomSelo }> = {
  sem_plano: { rotulo: 'Sem plano', tom: 'neutro' },
  teste: { rotulo: 'Teste', tom: 'acento' },
  ativa: { rotulo: 'Ativa', tom: 'sucesso' },
  carencia: { rotulo: 'Pendente', tom: 'atencao' },
  somente_leitura: { rotulo: 'Só leitura', tom: 'erro' },
};
const SAUDE: Record<Semaforo, TomSelo> = { ok: 'sucesso', atencao: 'atencao', problema: 'erro' };
const r = (c: number) => formatarReais(c, { semCentavosQuandoInteiro: true });

export function PainelAdmin() {
  const { dados, erro } = useDados<Resposta>('/api/cobranca/admin');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | Fase | 'problema'>('todas');

  const lista = useMemo(() => (dados?.empresas ?? []).filter((e) =>
    (filtro === 'todas' || (filtro === 'problema' ? e.saude.cor !== 'ok' : e.fase === filtro)) &&
    (!busca || e.nome.toLowerCase().includes(busca.toLowerCase()) || e.id.includes(busca))), [dados, busca, filtro]);

  if (erro) return <div className="mx-auto max-w-lg py-16"><Vazio icone={<ShieldCheck />} titulo="Área da equipe Atena" descricao={erro} /></div>;
  if (!dados) return <div className="grid gap-4 p-6"><Esqueleto className="h-24" /><Esqueleto className="h-96" /></div>;
  const t = dados.totais;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <Cabecalho titulo="Painel Atena" descricao={`Visão interna · mês ${dados.mes}. Custos de IA são estimativas.`} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {[
          ['Empresas', String(t.empresas)], ['Pagantes', String(t.pagantes)], ['Em teste', String(t.emTeste)],
          ['Vencidas', String(t.vencidas)], ['Receita/mês', r(t.mrr)], ['Custo IA (mês)', r(t.custoIA)],
        ].map(([rotulo, valor]) => (
          <Cartao key={rotulo} className="p-4">
            <p className="text-xs text-texto-3">{rotulo}</p>
            <p className="mt-1 font-mono text-xl">{valor}</p>
          </Cartao>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-3" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa" aria-label="Buscar empresa"
            className="h-10 w-full rounded-[10px] border border-borda bg-superficie pl-9 pr-3 text-sm" />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtro">
          {(['todas', 'ativa', 'teste', 'carencia', 'somente_leitura', 'problema'] as const).map((f) => (
            <button key={f} aria-pressed={filtro === f} onClick={() => setFiltro(f)}
              className={cx('h-8 rounded-lg border px-3 text-[13px]', filtro === f ? 'border-acento-1/40 bg-acento-1/10 text-texto' : 'border-borda text-texto-2')}>
              {f === 'todas' ? 'Todas' : f === 'problema' ? 'Com problema' : FASE[f].rotulo}
            </button>
          ))}
        </div>
      </div>

      <Cartao className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="text-left text-xs text-texto-3">
            <tr className="border-b border-borda">
              <th className="px-4 py-3 font-medium">Empresa</th><th className="px-3 py-3 font-medium">Plano</th>
              <th className="px-3 py-3 font-medium">Situação</th><th className="px-3 py-3 text-right font-medium">Receita</th>
              <th className="px-3 py-3 text-right font-medium">Custo IA</th><th className="px-3 py-3 text-right font-medium">Margem</th>
              <th className="px-3 py-3 text-right font-medium">Créditos</th><th className="px-4 py-3 font-medium">Saúde</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((e) => (
              <tr key={e.id} className="border-b border-borda last:border-0">
                <td className="px-4 py-3"><p className="font-medium">{e.nome}</p><p className="text-xs text-texto-3">{e.segmento} · {e.membros} pessoa(s) · desde {formatarDataBR(e.criadoEm)}</p></td>
                <td className="px-3 py-3">{e.planoId ?? '—'}</td>
                <td className="px-3 py-3"><Selo tom={FASE[e.fase].tom}>{FASE[e.fase].rotulo}</Selo>{e.liberadoAte && <p className="mt-1 text-xs text-texto-3">até {formatarDataBR(e.liberadoAte)}</p>}</td>
                <td className="px-3 py-3 text-right font-mono">{r(e.receitaMensal)}</td>
                <td className="px-3 py-3 text-right font-mono" title={e.modelosSemPreco.length ? `Sem preço: ${e.modelosSemPreco.join(', ')}` : undefined}>{r(e.custoIA)}{e.modelosSemPreco.length ? '*' : ''}</td>
                <td className={cx('px-3 py-3 text-right font-mono', e.receitaMensal > 0 && e.margem.pct < 50 && 'text-atencao')}>{e.receitaMensal > 0 ? `${e.margem.pct}%` : '—'}</td>
                <td className="px-3 py-3 text-right font-mono">{e.creditos}</td>
                <td className="px-4 py-3"><Selo tom={SAUDE[e.saude.cor]} ponto>{e.saude.cor === 'ok' ? 'OK' : e.saude.motivos[0]}</Selo></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && <p className="p-6 text-center text-sm text-texto-3">Nenhuma empresa neste filtro.</p>}
      </Cartao>

      <Cartao className="mt-6">
        <CabecalhoCartao icone={<AlertTriangle />} titulo="Alertas de cobrança" descricao="Pagamentos recusados pela regra (empresa trocada, valor errado)." />
        <CorpoCartao>
          {dados.alertas.length === 0 ? <p className="text-sm text-texto-3">Nenhum alerta.</p> : (
            <ul className="divide-y divide-borda text-sm">
              {dados.alertas.map((a, i) => (
                <li key={i} className="flex flex-wrap justify-between gap-2 py-2"><span>{a.motivo}</span><span className="text-xs text-texto-3">{a.empresaId ?? '—'} · {a.pagamentoId ?? ''} · {formatarDataBR(a.quando)}</span></li>
              ))}
            </ul>
          )}
        </CorpoCartao>
      </Cartao>
    </div>
  );
}
