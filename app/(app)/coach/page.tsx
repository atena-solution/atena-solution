'use client';
// /coach — Placar e evolução da equipe, últimas reuniões e biblioteca.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LinhaPlacar, PontoSemana } from '@/lib/coach/placar';
import type { Reuniao, Resultado } from '@/lib/coach/tipos';
import { api } from './_componentes/api';
import { Aviso, Cartao, Esqueleto, Numero, Selo, Vazio } from './_componentes/ui';
import { nota, corNota, dataCurta, RESULTADO, STATUS } from './_componentes/rotulos';
import { formatarTempo } from '@/lib/coach/transcricao';

interface Placar {
  linhas: LinhaPlacar[];
  tendencia: PontoSemana[];
  objecoesSemana: { objecao: string; vezes: number; bemRespondidas: number }[];
  biblioteca: { id: string; titulo: string; vendedorNome: string; nota: number; resultado: Resultado; criadoEm: string }[];
  papel: string;
}
type ReuniaoLeve = Omit<Reuniao, 'pedacos'> & { pedacos: number };

export default function PaginaCoach() {
  const [placar, setPlacar] = useState<Placar | null>(null);
  const [reunioes, setReunioes] = useState<ReuniaoLeve[] | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([api<Placar>('/api/coach/placar'), api<{ reunioes: ReuniaoLeve[] }>('/api/coach/reunioes')])
      .then(([p, r]) => { setPlacar(p); setReunioes(r.reunioes); })
      .catch((e: Error) => setErro(e.message));
  }, []);

  const equipe = placar ? resumoEquipe(placar.linhas) : null;
  const gestor = placar?.papel === 'dono' || placar?.papel === 'gestor';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-serif text-4xl">Coach de Vendas</h1>
          <p className="mt-1 text-sm text-[var(--coach-suave)]">Cada reunião vira nota, conselho e follow-up pronto.</p>
        </div>
        <Link href="/coach/gravar" className="rounded-[10px] px-5 py-2.5 text-sm font-medium text-white [background:var(--coach-grad)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--coach-acento)]">
          Gravar reunião
        </Link>
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}

      {!placar || !reunioes ? (
        !erro && <div className="grid gap-4 sm:grid-cols-3"><Esqueleto /><Esqueleto /><Esqueleto /></div>
      ) : reunioes.length === 0 ? (
        <Vazio
          titulo="Nenhuma reunião ainda"
          texto="Grave a próxima reunião de venda (online ou presencial) ou envie um áudio já gravado. Em poucos minutos sai a nota, o que melhorar e a mensagem de follow-up."
          acao={<Link className="text-sm font-medium text-[var(--coach-acento)] underline" href="/coach/gravar">Gravar a primeira</Link>}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi rotulo={gestor ? 'Reuniões da equipe (8 semanas)' : 'Suas reuniões (8 semanas)'} valor={equipe!.reunioes} />
            <Kpi rotulo="Nota média" valor={equipe!.nota} cor={corNota(equipe!.nota)} decimal />
            <Kpi rotulo="Taxa de fechamento" valor={equipe!.taxa} sufixo="%" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Cartao titulo="Placar por vendedor" className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-[var(--coach-suave)]">
                    <tr><th className="py-2 pr-3 font-normal">Vendedor</th><th className="pr-3 font-normal">Reuniões</th><th className="pr-3 font-normal">Nota</th><th className="pr-3 font-normal">Fecha</th><th className="hidden pr-3 font-normal sm:table-cell" title="% do tempo que o vendedor falou">Fala</th><th className="hidden font-normal sm:table-cell">Mais esquece</th></tr>
                  </thead>
                  <tbody>
                    {placar.linhas.map((l, i) => (
                      <tr key={l.vendedorUid} className="border-t border-[var(--coach-borda)]">
                        <td className="py-2.5 pr-3"><span className="num mr-2 text-xs text-[var(--coach-suave)]">{i + 1}</span>{l.vendedorNome}</td>
                        <td><Numero valor={l.reunioes} /></td>
                        <td><span className="num font-normal" style={{ color: corNota(l.notaMedia) }}>{nota(l.notaMedia)}</span></td>
                        <td><Numero valor={l.taxaFechamento} sufixo="%" /></td>
                        <td className="hidden sm:table-cell" title="% do tempo que o vendedor falou"><Numero valor={l.falaVendedorMedia} sufixo="%" /></td>
                        <td className="hidden text-xs text-[var(--coach-suave)] sm:table-cell">{l.etapasEsquecidas[0]?.nome ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Cartao>

            <Cartao titulo="Objeções da semana">
              {placar.objecoesSemana.length === 0 ? (
                <p className="text-sm text-[var(--coach-suave)]">Nenhuma objeção nos últimos 7 dias.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {placar.objecoesSemana.map((o) => (
                    <li key={o.objecao} className="flex items-center justify-between gap-3 text-sm">
                      <span>“{o.objecao}”</span>
                      <span className="num shrink-0 text-xs text-[var(--coach-suave)]" title="vezes · bem respondidas">{o.vezes}× · {o.bemRespondidas} ✓</span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Cartao titulo="Nota média por semana" className="lg:col-span-2">
              <GraficoSemanas pontos={placar.tendencia} />
            </Cartao>
            <Cartao titulo="Biblioteca — reuniões pra treinar">
              {placar.biblioteca.length === 0 ? (
                <p className="text-sm text-[var(--coach-suave)]">As reuniões com nota 8 ou mais (ou marcadas pelo gestor) aparecem aqui.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {placar.biblioteca.map((b) => (
                    <li key={b.id}>
                      <Link href={`/coach/reunioes/${b.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--coach-acento-suave)]">
                        <span className="truncate">{b.titulo}<span className="block text-xs text-[var(--coach-suave)]">{b.vendedorNome} · {dataCurta(b.criadoEm)}</span></span>
                        <span className="num" style={{ color: corNota(b.nota) }}>{nota(b.nota)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          </div>

          <Cartao titulo="Últimas reuniões">
            <ul className="divide-y divide-[var(--coach-borda)]">
              {reunioes.slice(0, 30).map((r) => (
                <li key={r.id}>
                  <Link href={`/coach/reunioes/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.titulo}</p>
                      <p className="text-xs text-[var(--coach-suave)]">{r.vendedorNome} · {dataCurta(r.criadoEm)} · <span className="num">{formatarTempo(r.duracaoSeg)}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.analise ? <Selo tom={RESULTADO[r.analise.resultado].tom}>{RESULTADO[r.analise.resultado].texto}</Selo> : <Selo>{STATUS[r.status]}</Selo>}
                      {r.analise && <span className="num w-10 text-right text-lg" style={{ color: corNota(r.analise.nota) }}>{nota(r.analise.nota)}</span>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        </>
      )}
    </div>
  );
}

function resumoEquipe(linhas: LinhaPlacar[]) {
  const reunioes = linhas.reduce((a, l) => a + l.reunioes, 0);
  const an = linhas.reduce((a, l) => a + l.analisadas, 0);
  const somaNota = linhas.reduce((a, l) => a + (l.notaMedia ?? 0) * l.analisadas, 0);
  const fechou = linhas.reduce((a, l) => a + ((l.taxaFechamento ?? 0) / 100) * l.analisadas, 0);
  return { reunioes, nota: an ? Math.round((somaNota / an) * 10) / 10 : null, taxa: an ? Math.round((fechou / an) * 100) : null };
}

function Kpi({ rotulo, valor, sufixo, cor, decimal }: { rotulo: string; valor: number | null; sufixo?: string; cor?: string; decimal?: boolean }) {
  return (
    <Cartao>
      <p className="text-xs text-[var(--coach-suave)]">{rotulo}</p>
      <p className="num mt-2 text-4xl" style={cor ? { color: cor } : undefined}>{decimal ? nota(valor) : valor === null ? '—' : `${valor.toLocaleString('pt-BR')}${sufixo ?? ''}`}</p>
    </Cartao>
  );
}

function GraficoSemanas({ pontos }: { pontos: PontoSemana[] }) {
  const L = 560, A = 140, m = 24;
  const passo = (L - m * 2) / Math.max(1, pontos.length - 1);
  const y = (n: number) => A - m - (n / 10) * (A - m * 2);
  const comNota = pontos.map((p, i) => ({ ...p, x: m + i * passo })).filter((p) => p.notaMedia !== null);
  const linha = comNota.map((p, i) => `${i ? 'L' : 'M'}${p.x},${y(p.notaMedia!)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${L} ${A + 18}`} className="w-full" role="img" aria-label="Nota média por semana">
      {[0, 5, 10].map((n) => (
        <g key={n}>
          <line x1={m} x2={L - m} y1={y(n)} y2={y(n)} stroke="var(--coach-borda)" strokeDasharray={n === 5 ? '3 4' : undefined} />
          <text x={4} y={y(n) + 4} fontSize="10" fill="var(--coach-suave)">{n}</text>
        </g>
      ))}
      {linha && <path d={linha} fill="none" stroke="var(--coach-acento)" strokeWidth="2" strokeLinejoin="round" />}
      {pontos.map((p, i) => {
        const x = m + i * passo;
        return (
          <g key={p.semana}>
            {p.notaMedia !== null && <circle cx={x} cy={y(p.notaMedia)} r="3.5" fill="var(--coach-acento)"><title>{`${p.notaMedia} · ${p.reunioes} reuniões`}</title></circle>}
            <text x={x} y={A + 12} fontSize="10" textAnchor="middle" fill="var(--coach-suave)">{p.semana.slice(8, 10)}/{p.semana.slice(5, 7)}</text>
          </g>
        );
      })}
    </svg>
  );
}
