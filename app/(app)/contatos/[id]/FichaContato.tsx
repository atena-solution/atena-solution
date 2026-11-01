'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarPlus, MessageCircle, StickyNote, CalendarDays, Mic, ArrowRightLeft, Pencil, Trash2, X, Bot } from 'lucide-react';
import { AreaTexto, Avatar, Botao, Campo, Cartao, CabecalhoCartao, CorpoCartao, Esqueleto, Modal, Select, Selo, Vazio, useToast } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import { ORIGENS_COMUNS, etapasDaEmpresa } from '@/lib/contatos/funil';
import { formatarTelefone, tempoRelativo } from '@/lib/ui/formato';
import { NOME_STATUS, TOM_STATUS } from '@/lib/agenda/horarios';
import { dataLocal, horaLocal } from '@/lib/agenda/fuso';
import type { Agendamento, Atividade, Contato, Membro, Servico, TipoAtividade } from '@/lib/tipos';

const ICONE_ATIVIDADE: Record<TipoAtividade, typeof StickyNote> = {
  mensagem: MessageCircle,
  agendamento: CalendarDays,
  reuniao: Mic,
  nota: StickyNote,
  etapa: ArrowRightLeft,
};


export function FichaContato({ id }: { id: string }) {
  const router = useRouter();
  const { api, empresa, sessao } = useSessao();
  const { avisar } = useToast();
  const { dados, erro, recarregar, setDados } = useDados<{ contato: Contato; atividades: Atividade[]; agendamentos: Agendamento[] }>(`/api/contatos/${id}`);
  const { dados: equipe } = useDados<{ membros: Membro[] }>('/api/equipe');
  const { dados: sv } = useDados<{ servicos: Servico[] }>('/api/servicos');
  const [nota, setNota] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);
  const [editando, setEditando] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState('');
  const etapas = etapasDaEmpresa(empresa?.etapas);
  const fuso = empresa?.fuso ?? 'America/Sao_Paulo';

  if (erro) return <Cartao><Vazio titulo="Contato não encontrado" descricao={erro} acao={<Link href="/contatos" className="text-sm text-acento">Voltar para contatos</Link>} /></Cartao>;
  if (!dados) return <div className="flex flex-col gap-4"><Esqueleto className="h-10 w-64" /><Esqueleto className="h-64 w-full" /></div>;

  const { contato, atividades, agendamentos } = dados;
  const nomeMembro = (uid?: string) => equipe?.membros.find((m) => m.uid === uid)?.nome;
  const nomeServico = (sid: string) => sv?.servicos.find((s) => s.id === sid)?.nome ?? 'Serviço';

  async function atualizar(mudanca: Partial<Contato>) {
    try {
      await api(`/api/contatos/${id}`, { metodo: 'PATCH', corpo: mudanca });
      recarregar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    }
  }

  async function salvarNota(e: React.FormEvent) {
    e.preventDefault();
    if (!nota.trim()) return;
    setSalvandoNota(true);
    try {
      const r = await api<{ atividade: Atividade }>(`/api/contatos/${id}/atividades`, { corpo: { resumo: nota } });
      setDados({ ...dados!, atividades: [r.atividade, ...dados!.atividades] });
      setNota('');
    } catch (x) {
      avisar((x as Error).message, 'erro');
    } finally {
      setSalvandoNota(false);
    }
  }

  async function apagar() {
    if (!confirm(`Apagar ${contato.nome}? Isso não pode ser desfeito.`)) return;
    await api(`/api/contatos/${id}`, { metodo: 'DELETE' });
    avisar('Contato apagado.');
    router.push('/contatos');
  }

  return (
    <>
      <Link href="/contatos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-texto-2 hover:text-texto">
        <ArrowLeft className="size-4" aria-hidden /> Contatos
      </Link>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar nome={contato.nome} tamanho="g" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{contato.nome}</h1>
          <p className="numero text-sm text-texto-2">{formatarTelefone(contato.telefone)}{contato.email ? ` · ${contato.email}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`https://wa.me/${contato.telefone}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-borda bg-superficie px-4 text-sm font-medium hover:bg-superficie-2">
            <MessageCircle className="size-4" style={{ color: 'var(--aba-atendimento)' }} aria-hidden /> WhatsApp
          </a>
          <Botao icone={<CalendarPlus className="size-4" />} onClick={() => router.push(`/agenda?novo=1&contato=${contato.id}`)}>
            Marcar horário
          </Botao>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
        <div className="flex flex-col gap-5">
          <Cartao>
            <CabecalhoCartao
              titulo="Dados"
              acao={
                <Botao variante="fantasma" tamanho="p" icone={<Pencil className="size-3.5" />} onClick={() => setEditando(true)}>
                  Editar
                </Botao>
              }
            />
            <CorpoCartao className="flex flex-col gap-4">
              <Select rotulo="Etapa do funil" value={contato.etapa} onChange={(e) => atualizar({ etapa: e.target.value })} opcoes={etapas.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
              <Select
                rotulo="Responsável"
                vazio="Ninguém"
                value={contato.responsavelUid ?? ''}
                onChange={(e) => atualizar({ responsavelUid: e.target.value })}
                opcoes={(equipe?.membros ?? []).filter((m) => m.ativo).map((m) => ({ valor: m.uid, rotulo: m.nome }))}
              />
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-texto-2">Etiquetas</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {contato.etiquetas.map((t) => (
                    <span key={t} className="inline-flex h-6 items-center gap-1 rounded-full border border-borda bg-superficie-2 pl-2.5 pr-1 text-xs">
                      {t}
                      <button aria-label={`Tirar ${t}`} onClick={() => atualizar({ etiquetas: contato.etiquetas.filter((x) => x !== t) })} className="rounded-full p-0.5 text-texto-3 hover:text-texto">
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const t = novaEtiqueta.trim();
                      if (t && !contato.etiquetas.includes(t)) atualizar({ etiquetas: [...contato.etiquetas, t] });
                      setNovaEtiqueta('');
                    }}
                  >
                    <input
                      value={novaEtiqueta}
                      onChange={(e) => setNovaEtiqueta(e.target.value)}
                      placeholder="+ etiqueta"
                      aria-label="Nova etiqueta"
                      className="h-6 w-24 rounded-full border border-dashed border-borda-forte bg-transparent px-2.5 text-xs outline-none focus:border-acento-1"
                    />
                  </form>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-borda pt-4 text-sm">
                <dt className="text-texto-3">Origem</dt>
                <dd>{contato.origem}</dd>
                <dt className="text-texto-3">Desde</dt>
                <dd>{new Date(contato.criadoEm).toLocaleDateString('pt-BR', { timeZone: fuso })}</dd>
                <dt className="text-texto-3">Última vez</dt>
                <dd>{tempoRelativo(contato.ultimaInteracaoEm)}</dd>
                {Object.entries(contato.campos ?? {}).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-texto-3">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
            </CorpoCartao>
          </Cartao>

          <Cartao>
            <CabecalhoCartao titulo="Agendamentos" descricao={agendamentos.length ? undefined : 'Nenhum ainda.'} />
            <CorpoCartao className="flex flex-col gap-2">
              {agendamentos.map((a) => (
                <Link key={a.id} href={`/agenda?data=${dataLocal(a.inicio, fuso)}&ver=${a.id}`} className="flex items-center gap-3 rounded-xl border border-borda px-3 py-2.5 hover:bg-superficie-2">
                  <div className="numero w-14 text-center text-xs leading-tight text-texto-2">
                    {dataLocal(a.inicio, fuso).split('-').reverse().slice(0, 2).join('/')}
                    <br />
                    {horaLocal(a.inicio, fuso)}
                  </div>
                  <span className="flex-1 truncate text-sm">{nomeServico(a.servicoId)}</span>
                  <Selo tom={TOM_STATUS[a.status]}>{NOME_STATUS[a.status]}</Selo>
                </Link>
              ))}
            </CorpoCartao>
          </Cartao>

          {(sessao?.papel === 'dono' || sessao?.papel === 'gestor') && (
            <Botao variante="fantasma" tamanho="p" icone={<Trash2 className="size-3.5" />} className="self-start text-erro" onClick={apagar}>
              Apagar contato
            </Botao>
          )}
        </div>

        <Cartao>
          <CabecalhoCartao titulo="Linha do tempo" descricao="Mensagens, agendamentos, reuniões e notas." />
          <CorpoCartao>
            <form onSubmit={salvarNota} className="mb-6 flex flex-col gap-2">
              <AreaTexto aria-label="Nova nota" placeholder="Escreva uma nota sobre o cliente (só a equipe vê)…" value={nota} onChange={(e) => setNota(e.target.value)} className="min-h-20" />
              <Botao type="submit" tamanho="p" variante="secundario" className="self-end" carregando={salvandoNota} disabled={!nota.trim()}>
                Salvar nota
              </Botao>
            </form>
            {atividades.length === 0 ? (
              <Vazio titulo="Nada por aqui ainda" descricao="Conversas, agendamentos e notas aparecem aqui." />
            ) : (
              <ol className="relative ml-3 border-l border-borda">
                {atividades.map((a) => {
                  const Icone = ICONE_ATIVIDADE[a.tipo] ?? StickyNote;
                  return (
                    <li key={a.id} className="relative mb-5 pl-6 last:mb-0">
                      <span className="absolute -left-3 top-0 flex size-6 items-center justify-center rounded-full border border-borda bg-superficie text-texto-2">
                        <Icone className="size-3" aria-hidden />
                      </span>
                      <p className="whitespace-pre-wrap text-sm">{a.resumo}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-texto-3">
                        {a.porIA ? (
                          <>
                            <Bot className="size-3" aria-hidden /> IA
                          </>
                        ) : (
                          nomeMembro(a.porUid) ?? 'Equipe'
                        )}
                        <span aria-hidden>·</span>
                        <time dateTime={a.quando}>{tempoRelativo(a.quando)}</time>
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </CorpoCartao>
        </Cartao>
      </div>

      <EditarContato aberto={editando} contato={contato} aoFechar={() => setEditando(false)} aoSalvar={() => (setEditando(false), recarregar())} />
    </>
  );
}

function EditarContato({ aberto, contato, aoFechar, aoSalvar }: { aberto: boolean; contato: Contato; aoFechar: () => void; aoSalvar: () => void }) {
  const { api } = useSessao();
  const { avisar } = useToast();
  const [f, setF] = useState({ nome: contato.nome, telefone: contato.telefone, email: contato.email ?? '', origem: contato.origem });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api(`/api/contatos/${contato.id}`, { metodo: 'PATCH', corpo: f });
      avisar('Contato atualizado.');
      aoSalvar();
    } catch (x) {
      const err = x as Error & { erros?: Record<string, string> };
      if (err.erros) setErros(err.erros);
      else avisar(err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Editar contato"
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-editar-contato" carregando={salvando}>Salvar</Botao>
        </>
      }
    >
      <form id="form-editar-contato" onSubmit={salvar} className="grid gap-4">
        <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} erro={erros.nome} />
        <Campo rotulo="WhatsApp" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} erro={erros.telefone} />
        <Campo rotulo="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} erro={erros.email} />
        <Select rotulo="Origem" value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })} opcoes={[...new Set([f.origem, ...ORIGENS_COMUNS])].map((o) => ({ valor: o, rotulo: o }))} />
      </form>
    </Modal>
  );
}
