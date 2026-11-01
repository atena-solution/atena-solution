'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, Bot, Clock, User, Settings } from 'lucide-react';
import { Botao, Cartao, Esqueleto, Folha, Select, Selo, Vazio, cx, useToast } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import { dataLocal, diaDaSemana, hhmmParaMin, horaLocal, minutosLocais, nomeDia, semanaDe, somarDias, instanteLocal } from '@/lib/agenda/fuso';
import { NOME_STATUS, TOM_STATUS } from '@/lib/agenda/horarios';
import { formatarReais, formatarTelefone } from '@/lib/ui/formato';
import type { Agendamento, HorarioDia, Profissional, Servico, StatusAgendamento } from '@/lib/tipos';
import { FormAgendamento } from './FormAgendamento';

type Visao = 'dia' | 'semana';
interface RespostaAgenda {
  agendamentos: Agendamento[];
  servicos: Servico[];
  profissionais: Profissional[];
  contatos: { id: string; nome: string; telefone: string }[];
  horarios: HorarioDia[];
  fuso: string;
}

const ALTURA_HORA = 64; // px por hora na grade

const COR_STATUS: Record<StatusAgendamento, string> = {
  marcado: 'var(--acento-1)',
  confirmado: 'var(--sucesso)',
  compareceu: 'var(--texto-3)',
  faltou: 'var(--erro)',
  cancelado: 'var(--borda-forte)',
};

export function TelaAgenda() {
  const router = useRouter();
  const params = useSearchParams();
  const { empresa, api } = useSessao();
  const { avisar } = useToast();
  const fuso = empresa?.fuso ?? 'America/Sao_Paulo';
  const hoje = dataLocal(new Date(), fuso);

  const [data, setData] = useState(params.get('data') ?? hoje);
  const [visao, setVisao] = useState<Visao>('dia');
  const [filtroProf, setFiltroProf] = useState('');
  const [form, setForm] = useState(params.get('novo') === '1');
  const [remarcar, setRemarcar] = useState<Agendamento | null>(null);
  const [aberto, setAberto] = useState<string | null>(params.get('ver'));

  const dias = visao === 'dia' ? [data] : semanaDe(data);
  const de = instanteLocal(dias[0], 0, fuso).toISOString();
  const ate = instanteLocal(somarDias(dias[dias.length - 1], 1), 0, fuso).toISOString();
  const { dados, recarregar, setDados } = useDados<RespostaAgenda>(`/api/agenda?de=${encodeURIComponent(de)}&ate=${encodeURIComponent(ate)}`);

  useEffect(() => {
    try {
      const v = localStorage.getItem('atena:agenda-visao') as Visao | null;
      if (v && window.innerWidth >= 768) setVisao(v);
    } catch {}
  }, []);
  function mudarVisao(v: Visao) {
    setVisao(v);
    try {
      localStorage.setItem('atena:agenda-visao', v);
    } catch {}
  }

  const ags = useMemo(
    () => (dados?.agendamentos ?? []).filter((a) => a.status !== 'cancelado' && (!filtroProf || a.profissionalId === filtroProf)),
    [dados, filtroProf],
  );
  const contato = (id: string) => dados?.contatos.find((c) => c.id === id);
  const servico = (id: string) => dados?.servicos.find((s) => s.id === id);
  const profissional = (id: string) => dados?.profissionais.find((p) => p.id === id);
  const selecionado = dados?.agendamentos.find((a) => a.id === aberto) ?? null;

  // faixa de horas da grade a partir do horário da empresa
  const [horaIni, horaFim] = useMemo(() => {
    const h = dados?.horarios ?? [];
    if (h.length === 0) return [8, 19];
    const ini = Math.floor(Math.min(...h.map((x) => hhmmParaMin(x.abre))) / 60);
    const fim = Math.ceil(Math.max(...h.map((x) => hhmmParaMin(x.fecha))) / 60);
    return [Math.max(0, ini), Math.min(24, Math.max(fim, ini + 4))];
  }, [dados]);

  async function mudarStatus(a: Agendamento, status: StatusAgendamento) {
    try {
      const r = await api<{ agendamento: Agendamento }>(`/api/agenda/${a.id}`, { metodo: 'PATCH', corpo: { status } });
      setDados({ ...dados!, agendamentos: dados!.agendamentos.map((x) => (x.id === a.id ? r.agendamento : x)) });
      avisar(status === 'cancelado' ? 'Agendamento cancelado.' : `Marcado como ${NOME_STATUS[status].toLowerCase()}.`);
      if (status === 'cancelado') setAberto(null);
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  const passo = visao === 'dia' ? 1 : 7;
  const titulo = (() => {
    const [a, m, d] = data.split('-').map(Number);
    const dt = new Date(Date.UTC(a, m - 1, d));
    if (visao === 'dia') {
      const rel = data === hoje ? 'Hoje · ' : data === somarDias(hoje, 1) ? 'Amanhã · ' : '';
      return rel + dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    }
    const [i, f] = [dias[0], dias[6]].map((x) => x.split('-').reverse().slice(0, 2).join('/'));
    return `${i} – ${f}`;
  })();

  const semConfig = dados && (dados.servicos.length === 0 || dados.profissionais.length === 0);
  const profsVisiveis = (dados?.profissionais ?? []).filter((p) => !filtroProf || p.id === filtroProf);

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-texto-2 first-letter:uppercase">{titulo}</p>
        </div>
        <Botao icone={<Plus className="size-4" />} onClick={() => (setRemarcar(null), setForm(true))} disabled={!!semConfig}>
          Marcar horário
        </Botao>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-[10px] border border-borda bg-superficie">
          <button aria-label="Anterior" onClick={() => setData(somarDias(data, -passo))} className="flex size-10 items-center justify-center text-texto-2 hover:text-texto">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setData(hoje)} className="h-10 border-x border-borda px-3 text-sm font-medium">
            Hoje
          </button>
          <button aria-label="Próximo" onClick={() => setData(somarDias(data, passo))} className="flex size-10 items-center justify-center text-texto-2 hover:text-texto">
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div role="group" aria-label="Visão" className="flex h-10 rounded-[10px] border border-borda bg-superficie p-1">
          {(['dia', 'semana'] as const).map((v) => (
            <button
              key={v}
              aria-pressed={visao === v}
              onClick={() => mudarVisao(v)}
              className={cx('rounded-lg px-3 text-sm capitalize', visao === v ? 'bg-superficie-2 font-medium' : 'text-texto-3 hover:text-texto')}
            >
              {v}
            </button>
          ))}
        </div>
        {(dados?.profissionais.length ?? 0) > 1 && (
          <div className="w-44">
            <Select aria-label="Profissional" vazio="Todos" value={filtroProf} onChange={(e) => setFiltroProf(e.target.value)} opcoes={(dados?.profissionais ?? []).map((p) => ({ valor: p.id, rotulo: p.nome }))} />
          </div>
        )}
      </div>

      {!dados ? (
        <Esqueleto className="h-[480px] w-full rounded-cartao" />
      ) : semConfig ? (
        <Cartao>
          <Vazio
            icone={<Settings />}
            titulo="Falta configurar a agenda"
            descricao="Cadastre os serviços (com duração e preço) e quem atende. A IA do Atendimento usa isso para marcar sozinha."
            acao={<Link href="/configuracoes?aba=servicos" className="gradiente-atena inline-flex h-10 items-center rounded-[10px] px-4 text-sm font-medium text-white">Cadastrar serviços</Link>}
          />
        </Cartao>
      ) : (
        <>
          {/* Celular: lista do dia/semana */}
          <div className="flex flex-col gap-5 md:hidden">
            {dias.map((d) => {
              const doDia = ags.filter((a) => dataLocal(a.inicio, fuso) === d);
              if (visao === 'semana' && doDia.length === 0) return null;
              return (
                <section key={d}>
                  {visao === 'semana' && <h2 className="mb-2 text-xs font-medium tracking-wide text-texto-3 uppercase">{nomeDia(diaDaSemana(d))} {d.split('-').reverse().slice(0, 2).join('/')}</h2>}
                  {doDia.length === 0 ? (
                    <Cartao><Vazio icone={<CalendarDays />} titulo="Dia livre" descricao="Nenhum horário marcado." /></Cartao>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {doDia.map((a) => (
                        <li key={a.id}>
                          <button onClick={() => setAberto(a.id)} className="flex w-full items-center gap-3 rounded-cartao border border-borda bg-superficie p-3.5 text-left">
                            <span className="h-10 w-1 rounded-full" style={{ background: COR_STATUS[a.status] }} aria-hidden />
                            <span className="numero w-12 text-sm">{horaLocal(a.inicio, fuso)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{contato(a.contatoId)?.nome ?? 'Cliente'}</span>
                              <span className="block truncate text-xs text-texto-3">{servico(a.servicoId)?.nome} · {profissional(a.profissionalId)?.nome}</span>
                            </span>
                            <Selo tom={TOM_STATUS[a.status]}>{NOME_STATUS[a.status]}</Selo>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
            {visao === 'semana' && ags.length === 0 && <Cartao><Vazio icone={<CalendarDays />} titulo="Semana livre" /></Cartao>}
          </div>

          {/* Desktop: grade */}
          <Cartao className="hidden overflow-hidden md:block">
            {(() => {
              const colunas = visao === 'dia' ? profsVisiveis.map((p) => ({ chave: p.id, titulo: p.nome, dia: data, prof: p.id })) : dias.map((d) => ({ chave: d, titulo: `${nomeDia(diaDaSemana(d), true)} ${d.split('-')[2]}`, dia: d, prof: '' }));
              const horas = Array.from({ length: horaFim - horaIni }, (_, i) => horaIni + i);
              const agora = new Date();
              const minAgora = minutosLocais(agora, fuso);
              return (
                <div className="flex">
                  <div className="w-14 shrink-0 border-r border-borda pt-11">
                    {horas.map((h) => (
                      <div key={h} className="numero relative text-right text-[11px] text-texto-3" style={{ height: ALTURA_HORA }}>
                        <span className="absolute -top-2 right-2">{String(h).padStart(2, '0')}:00</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${colunas.length}, minmax(0, 1fr))` }}>
                    {colunas.map((col) => {
                      const doCol = ags.filter((a) => dataLocal(a.inicio, fuso) === col.dia && (!col.prof || a.profissionalId === col.prof));
                      const ehHoje = col.dia === hoje;
                      return (
                        <div key={col.chave} className="border-r border-borda last:border-r-0">
                          <div className={cx('flex h-11 items-center justify-center border-b border-borda text-[13px] font-medium capitalize', ehHoje && visao === 'semana' && 'text-acento')}>{col.titulo}</div>
                          <div className="relative" style={{ height: horas.length * ALTURA_HORA }}>
                            {horas.map((h) => (
                              <div key={h} className="border-b border-borda/60" style={{ height: ALTURA_HORA }} />
                            ))}
                            {ehHoje && minAgora >= horaIni * 60 && minAgora <= horaFim * 60 && (
                              <div className="pointer-events-none absolute inset-x-0 z-10 h-px bg-erro" style={{ top: ((minAgora - horaIni * 60) / 60) * ALTURA_HORA }}>
                                <span className="absolute -left-1 -top-1 size-2 rounded-full bg-erro" />
                              </div>
                            )}
                            {doCol.map((a) => {
                              const ini = minutosLocais(a.inicio, fuso);
                              const dur = (new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 60000;
                              return (
                                <button
                                  key={a.id}
                                  onClick={() => setAberto(a.id)}
                                  className="absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1 text-left transition-shadow hover:shadow-md"
                                  style={{
                                    top: ((ini - horaIni * 60) / 60) * ALTURA_HORA + 1,
                                    height: Math.max((dur / 60) * ALTURA_HORA - 2, 22),
                                    background: `color-mix(in srgb, ${COR_STATUS[a.status]} 12%, var(--superficie))`,
                                    borderColor: `color-mix(in srgb, ${COR_STATUS[a.status]} 35%, transparent)`,
                                  }}
                                >
                                  <p className="truncate text-xs font-medium">
                                    {a.criadoPor === 'ia' && <Bot className="mr-1 inline size-3 text-atendimento" aria-label="Marcado pela IA" />}
                                    {dur < 45 && <span className="numero mr-1 font-normal text-texto-2">{horaLocal(a.inicio, fuso)}</span>}
                                    {contato(a.contatoId)?.nome ?? 'Cliente'}
                                  </p>
                                  {dur >= 45 && (
                                    <p className="numero truncate text-[11px] text-texto-2">
                                      {horaLocal(a.inicio, fuso)} · {servico(a.servicoId)?.nome}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </Cartao>
        </>
      )}

      {dados && (
        <FormAgendamento
          aberto={form}
          aoFechar={() => (setForm(false), setRemarcar(null))}
          aoSalvar={() => {
            setForm(false);
            setRemarcar(null);
            recarregar();
            if (params.get('novo')) router.replace('/agenda');
          }}
          servicos={dados.servicos}
          profissionais={dados.profissionais}
          fuso={fuso}
          dataInicial={data < hoje ? hoje : data}
          contatoInicial={params.get('contato') ?? undefined}
          remarcar={remarcar}
        />
      )}

      <Folha aberto={!!selecionado} aoFechar={() => setAberto(null)} titulo={selecionado ? contato(selecionado.contatoId)?.nome ?? 'Agendamento' : ''} descricao={selecionado ? formatarTelefone(contato(selecionado.contatoId)?.telefone ?? '') : undefined}>
        {selecionado && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Selo tom={TOM_STATUS[selecionado.status]} ponto>{NOME_STATUS[selecionado.status]}</Selo>
              {selecionado.criadoPor === 'ia' && <Selo tom="atendimento"><Bot className="size-3" aria-hidden /> Marcado pela IA</Selo>}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3 text-sm">
              <dt className="flex items-center gap-2 text-texto-3"><Clock className="size-4" aria-hidden /> Quando</dt>
              <dd className="first-letter:uppercase">
                {new Date(selecionado.inicio).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: fuso })}, {horaLocal(selecionado.inicio, fuso)}–{horaLocal(selecionado.fim, fuso)}
              </dd>
              <dt className="flex items-center gap-2 text-texto-3"><CalendarDays className="size-4" aria-hidden /> Serviço</dt>
              <dd>{servico(selecionado.servicoId)?.nome} · {formatarReais(servico(selecionado.servicoId)?.preco ?? 0)}</dd>
              <dt className="flex items-center gap-2 text-texto-3"><User className="size-4" aria-hidden /> Com</dt>
              <dd>{profissional(selecionado.profissionalId)?.nome}</dd>
            </dl>
            {selecionado.observacao && <p className="rounded-xl bg-superficie-2 p-3 text-sm">{selecionado.observacao}</p>}

            {selecionado.status !== 'cancelado' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {(['confirmado', 'compareceu', 'faltou'] as const).map((s) => (
                    <Botao key={s} variante={selecionado.status === s ? 'primario' : 'secundario'} onClick={() => mudarStatus(selecionado, s)}>
                      {s === 'confirmado' ? 'Confirmar' : NOME_STATUS[s]}
                    </Botao>
                  ))}
                  <Botao variante="secundario" onClick={() => (setRemarcar(selecionado), setData(dataLocal(selecionado.inicio, fuso)), setAberto(null), setForm(true))}>
                    Remarcar
                  </Botao>
                </div>
                <Botao
                  variante="fantasma"
                  className="text-erro"
                  onClick={() => confirm('Cancelar este horário? O horário fica livre de novo.') && mudarStatus(selecionado, 'cancelado')}
                >
                  Cancelar horário
                </Botao>
              </>
            )}
            <Link href={`/contatos/${selecionado.contatoId}`} className="text-sm text-acento hover:underline">
              Ver ficha do cliente →
            </Link>
          </div>
        )}
      </Folha>
    </>
  );
}
