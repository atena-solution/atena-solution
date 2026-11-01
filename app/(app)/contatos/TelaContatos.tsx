'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Upload, Search, List, KanbanSquare, Users } from 'lucide-react';
import { Avatar, Botao, Cabecalho, Campo, Cartao, EsqueletoLista, Select, Selo, Tabela, Vazio, cx, useToast } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import { agruparPorEtapa, etapasDaEmpresa, etiquetasUsadas, filtrarContatos } from '@/lib/contatos/funil';
import { formatarTelefone, tempoRelativo } from '@/lib/ui/formato';
import type { Contato, EtapaFunil, Membro } from '@/lib/tipos';
import { NovoContato } from './NovoContato';
import { ImportarCsv } from './ImportarCsv';

type Visao = 'lista' | 'quadro';

export function TelaContatos() {
  const router = useRouter();
  const params = useSearchParams();
  const { empresa, api, sessao } = useSessao();
  const { avisar } = useToast();
  const { dados, carregando, recarregar, setDados } = useDados<{ contatos: Contato[]; total: number }>('/api/contatos');
  const { dados: equipe } = useDados<{ membros: Membro[] }>('/api/equipe');
  const etapas = etapasDaEmpresa(empresa?.etapas);

  const [visao, setVisao] = useState<Visao>('lista');
  const [busca, setBusca] = useState('');
  const [etapa, setEtapa] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [novo, setNovo] = useState(params.get('novo') === '1');
  const [importar, setImportar] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem('atena:contatos-visao') as Visao | null;
      if (v) setVisao(v);
    } catch {}
  }, []);
  function mudarVisao(v: Visao) {
    setVisao(v);
    try {
      localStorage.setItem('atena:contatos-visao', v);
    } catch {}
  }

  const todos = useMemo(() => dados?.contatos ?? [], [dados]);
  const filtrados = useMemo(() => filtrarContatos(todos, { busca, etapa: etapa || undefined, etiqueta: etiqueta || undefined }), [todos, busca, etapa, etiqueta]);
  const etiquetas = useMemo(() => etiquetasUsadas(todos), [todos]);
  const nomeEtapa = (id: string) => etapas.find((e) => e.id === id);
  const nomeMembro = (uid?: string) => equipe?.membros.find((m) => m.uid === uid)?.nome;
  const podeImportar = sessao?.papel === 'dono' || sessao?.papel === 'gestor';

  async function mover(c: Contato, para: string) {
    if (c.etapa === para) return;
    const antes = todos;
    setDados({ contatos: todos.map((x) => (x.id === c.id ? { ...x, etapa: para, ultimaInteracaoEm: new Date().toISOString() } : x)), total: dados?.total ?? 0 });
    try {
      await api(`/api/contatos/${c.id}`, { metodo: 'PATCH', corpo: { etapa: para } });
    } catch (e) {
      setDados({ contatos: antes, total: dados?.total ?? 0 });
      avisar((e as Error).message, 'erro');
    }
  }

  return (
    <>
      <Cabecalho
        titulo="Contatos"
        descricao={dados ? `${dados.total} ${dados.total === 1 ? 'pessoa' : 'pessoas'} no funil` : 'Todo cliente, de onde veio e em que etapa está.'}
        acoes={
          <>
            {podeImportar && (
              <Botao variante="secundario" icone={<Upload className="size-4" />} onClick={() => setImportar(true)}>
                Importar
              </Botao>
            )}
            <Botao icone={<Plus className="size-4" />} onClick={() => setNovo(true)}>
              Novo contato
            </Botao>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end">
        <div className="md:w-72">
          <Campo aria-label="Buscar contatos" placeholder="Nome, telefone ou etiqueta" icone={<Search />} value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex">
          <Select aria-label="Filtrar por etapa" vazio="Todas as etapas" value={etapa} onChange={(e) => setEtapa(e.target.value)} opcoes={etapas.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
          <Select aria-label="Filtrar por etiqueta" vazio="Todas as etiquetas" value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} opcoes={etiquetas.map((e) => ({ valor: e, rotulo: e }))} />
        </div>
        <div role="group" aria-label="Visão" className="flex h-10 shrink-0 rounded-[10px] border border-borda bg-superficie p-1 md:ml-auto">
          {(
            [
              ['lista', 'Lista', List],
              ['quadro', 'Quadro', KanbanSquare],
            ] as const
          ).map(([v, rotulo, Icone]) => (
            <button
              key={v}
              aria-pressed={visao === v}
              onClick={() => mudarVisao(v)}
              className={cx('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm', visao === v ? 'bg-superficie-2 font-medium text-texto' : 'text-texto-3 hover:text-texto')}
            >
              <Icone className="size-4" aria-hidden /> {rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <Cartao className="p-5">
          <EsqueletoLista linhas={6} />
        </Cartao>
      ) : todos.length === 0 ? (
        <Cartao>
          <Vazio
            icone={<Users />}
            titulo="Nenhum contato ainda"
            descricao="Quando alguém chamar no WhatsApp, entra aqui sozinho. Você também pode importar sua lista de clientes."
            acao={
              <div className="flex gap-2">
                {podeImportar && <Botao variante="secundario" onClick={() => setImportar(true)}>Importar CSV</Botao>}
                <Botao onClick={() => setNovo(true)}>Adicionar contato</Botao>
              </div>
            }
          />
        </Cartao>
      ) : visao === 'lista' ? (
        <Tabela
          linhas={filtrados}
          chaveLinha={(c) => c.id}
          aoClicar={(c) => router.push(`/contatos/${c.id}`)}
          vazio={<Cartao><Vazio titulo="Ninguém com esse filtro" descricao="Tente outra busca ou limpe os filtros." /></Cartao>}
          colunas={[
            {
              chave: 'nome',
              titulo: 'Nome',
              render: (c) => (
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar nome={c.nome} tamanho="p" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.nome}</span>
                    <span className="numero block text-xs text-texto-3">{formatarTelefone(c.telefone)}</span>
                  </span>
                </span>
              ),
            },
            {
              chave: 'etapa',
              titulo: 'Etapa',
              render: (c) => <SeloEtapa etapa={nomeEtapa(c.etapa)} />,
            },
            {
              chave: 'etiquetas',
              titulo: 'Etiquetas',
              ocultarCelular: true,
              render: (c) => (
                <span className="flex flex-wrap gap-1">
                  {c.etiquetas.slice(0, 3).map((e) => (
                    <Selo key={e}>{e}</Selo>
                  ))}
                </span>
              ),
            },
            { chave: 'origem', titulo: 'Origem', ocultarCelular: true, render: (c) => <span className="text-texto-2">{c.origem}</span> },
            { chave: 'resp', titulo: 'Responsável', ocultarCelular: true, render: (c) => <span className="text-texto-2">{nomeMembro(c.responsavelUid) ?? '—'}</span> },
            { chave: 'ultima', titulo: 'Última vez', ocultarCelular: true, render: (c) => <span className="text-texto-3">{tempoRelativo(c.ultimaInteracaoEm)}</span> },
          ]}
        />
      ) : (
        <Quadro contatos={filtrados} etapas={etapas} aoMover={mover} />
      )}

      <NovoContato
        aberto={novo}
        aoFechar={() => setNovo(false)}
        aoCriar={(c) => {
          setNovo(false);
          recarregar();
          router.push(`/contatos/${c.id}`);
        }}
      />
      <ImportarCsv aberto={importar} aoFechar={() => setImportar(false)} aoImportar={recarregar} />
    </>
  );
}

export function SeloEtapa({ etapa }: { etapa?: EtapaFunil }) {
  if (!etapa) return <Selo>—</Selo>;
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap"
      style={{
        color: etapa.cor ?? 'var(--texto-2)',
        borderColor: `color-mix(in srgb, ${etapa.cor ?? '#868C97'} 30%, transparent)`,
        background: `color-mix(in srgb, ${etapa.cor ?? '#868C97'} 10%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {etapa.nome}
    </span>
  );
}

/** Quadro (kanban): arrastar entre colunas; no teclado, Alt+→/Alt+← muda de etapa. */
function Quadro({ contatos, etapas, aoMover }: { contatos: Contato[]; etapas: EtapaFunil[]; aoMover: (c: Contato, etapa: string) => void }) {
  const grupos = agruparPorEtapa(contatos, etapas);
  const [sobre, setSobre] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<Contato | null>(null);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
      <div className="flex snap-x gap-3" style={{ minWidth: `${etapas.length * 264}px` }}>
        {etapas.map((et, i) => (
          <section
            key={et.id}
            aria-label={et.nome}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(et.id);
            }}
            onDragLeave={() => setSobre((s) => (s === et.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              setSobre(null);
              if (arrastando) aoMover(arrastando, et.id);
              setArrastando(null);
            }}
            className={cx(
              'flex w-64 shrink-0 snap-start flex-col rounded-cartao border bg-superficie-2/50 transition-colors',
              sobre === et.id ? 'border-acento-1 bg-acento-1/5' : 'border-borda',
            )}
          >
            <header className="flex items-center gap-2 px-3.5 py-3">
              <span className="size-2 rounded-full" style={{ background: et.cor ?? 'var(--texto-3)' }} aria-hidden />
              <h3 className="flex-1 text-[13px] font-semibold">{et.nome}</h3>
              <span className="numero text-xs text-texto-3">{grupos[et.id].length}</span>
            </header>
            <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
              {grupos[et.id].map((c) => (
                <Link
                  key={c.id}
                  href={`/contatos/${c.id}`}
                  draggable
                  onDragStart={() => setArrastando(c)}
                  onDragEnd={() => setArrastando(null)}
                  onKeyDown={(e) => {
                    if (!e.altKey) return;
                    const j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
                    if (j >= 0 && j < etapas.length && j !== i) {
                      e.preventDefault();
                      aoMover(c, etapas[j].id);
                    }
                  }}
                  title="Arraste para outra etapa (ou Alt + seta)"
                  className={cx(
                    'group rounded-xl border border-borda bg-superficie p-3 transition-all duration-150 hover:border-borda-forte',
                    arrastando?.id === c.id && 'opacity-50',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <Avatar nome={c.nome} tamanho="p" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nome}</p>
                      <p className="numero truncate text-[11px] text-texto-3">{formatarTelefone(c.telefone)}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 gap-1 overflow-hidden">
                      {c.etiquetas.slice(0, 2).map((e) => (
                        <span key={e} className="truncate rounded-md bg-superficie-2 px-1.5 py-0.5 text-[11px] text-texto-2">
                          {e}
                        </span>
                      ))}
                    </span>
                    <span className="shrink-0 text-[11px] text-texto-3">{tempoRelativo(c.ultimaInteracaoEm)}</span>
                  </div>
                </Link>
              ))}
              {grupos[et.id].length === 0 && <p className="px-2 py-6 text-center text-xs text-texto-3">Arraste um contato para cá</p>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
