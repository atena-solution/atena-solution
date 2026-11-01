'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Botao, Campo, Modal, Select, cx, useToast } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { horaLocal, somarDias } from '@/lib/agenda/fuso';
import { formatarReais, formatarTelefone } from '@/lib/ui/formato';
import type { Agendamento, Contato, Profissional, Servico } from '@/lib/tipos';

interface Props {
  aberto: boolean;
  aoFechar: () => void;
  aoSalvar: () => void;
  servicos: Servico[];
  profissionais: Profissional[];
  fuso: string;
  dataInicial: string;
  contatoInicial?: string;
  /** Quando presente, remarca este agendamento. */
  remarcar?: Agendamento | null;
}

/** Marcar ou remarcar: cliente → serviço → profissional → dia → horário livre. */
export function FormAgendamento({ aberto, aoFechar, aoSalvar, servicos, profissionais, fuso, dataInicial, contatoInicial, remarcar }: Props) {
  const { api } = useSessao();
  const { avisar } = useToast();
  const [contato, setContato] = useState<Pick<Contato, 'id' | 'nome' | 'telefone'> | null>(null);
  const [busca, setBusca] = useState('');
  const [sugestoes, setSugestoes] = useState<Contato[]>([]);
  const [servicoId, setServicoId] = useState('');
  const [profissionalId, setProfissionalId] = useState('');
  const [data, setData] = useState(dataInicial);
  const [livres, setLivres] = useState<{ profissionalId: string; profissional: string; horarios: string[] }[] | null>(null);
  const [escolha, setEscolha] = useState<{ inicio: string; profissionalId: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  // preenche ao abrir
  useEffect(() => {
    if (!aberto) return;
    setData(dataInicial);
    setEscolha(null);
    setBusca('');
    if (remarcar) {
      setServicoId(remarcar.servicoId);
      setProfissionalId(remarcar.profissionalId);
      setContato({ id: remarcar.contatoId, nome: '', telefone: '' });
    } else {
      setServicoId(servicos[0]?.id ?? '');
      setProfissionalId('');
      setContato(null);
      if (contatoInicial) {
        api<{ contato: Contato }>(`/api/contatos/${contatoInicial}`).then((r) => setContato(r.contato)).catch(() => {});
      }
    }
  }, [aberto, remarcar, contatoInicial, dataInicial, servicos, api]);

  useEffect(() => {
    if (busca.trim().length < 2) return setSugestoes([]);
    const t = setTimeout(() => {
      api<{ contatos: Contato[] }>(`/api/contatos?busca=${encodeURIComponent(busca)}&limite=6`).then((r) => setSugestoes(r.contatos)).catch(() => {});
    }, 180);
    return () => clearTimeout(t);
  }, [busca, api]);

  useEffect(() => {
    if (!aberto || !servicoId || !data) return;
    setLivres(null);
    setEscolha(null);
    const q = new URLSearchParams({ data, servicoId });
    if (profissionalId) q.set('profissionalId', profissionalId);
    if (remarcar) q.set('ignorar', remarcar.id);
    api<{ livres: typeof livres }>(`/api/agenda/livres?${q}`)
      .then((r) => setLivres(r.livres))
      .catch((e) => avisar((e as Error).message, 'erro'));
  }, [aberto, servicoId, profissionalId, data, remarcar, api, avisar]);

  const servico = servicos.find((s) => s.id === servicoId);
  const profissionaisDoServico = useMemo(
    () => profissionais.filter((p) => p.servicosIds.length === 0 || p.servicosIds.includes(servicoId)),
    [profissionais, servicoId],
  );

  async function salvar() {
    if (!escolha || !contato) return;
    setSalvando(true);
    try {
      if (remarcar) {
        await api(`/api/agenda/${remarcar.id}`, { metodo: 'PATCH', corpo: { inicio: escolha.inicio, profissionalId: escolha.profissionalId, servicoId } });
        avisar('Horário remarcado.');
      } else {
        await api('/api/agenda', { corpo: { contatoId: contato.id, servicoId, profissionalId: escolha.profissionalId, inicio: escolha.inicio } });
        avisar('Horário marcado.');
      }
      aoSalvar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={remarcar ? 'Remarcar horário' : 'Marcar horário'}
      largura="g"
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao onClick={salvar} disabled={!escolha || !contato} carregando={salvando}>
            {escolha ? `${remarcar ? 'Remarcar' : 'Marcar'} às ${horaLocal(escolha.inicio, fuso)}` : 'Escolha um horário'}
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {!remarcar && (
          <div>
            {contato ? (
              <div className="flex items-center justify-between rounded-xl border border-borda bg-superficie-2/50 px-3.5 py-2.5">
                <div>
                  <p className="text-sm font-medium">{contato.nome}</p>
                  <p className="numero text-xs text-texto-3">{formatarTelefone(contato.telefone)}</p>
                </div>
                <Botao variante="fantasma" tamanho="p" onClick={() => setContato(null)}>Trocar</Botao>
              </div>
            ) : (
              <div className="relative">
                <Campo rotulo="Cliente" placeholder="Buscar por nome ou telefone" icone={<Search />} value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
                {sugestoes.length > 0 && (
                  <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-borda bg-superficie shadow-lg">
                    {sugestoes.map((c) => (
                      <li key={c.id}>
                        <button onClick={() => (setContato(c), setSugestoes([]))} className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-sm hover:bg-superficie-2">
                          {c.nome}
                          <span className="numero text-xs text-texto-3">{formatarTelefone(c.telefone)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            rotulo="Serviço"
            value={servicoId}
            onChange={(e) => (setServicoId(e.target.value), setProfissionalId(''))}
            opcoes={servicos.map((s) => ({ valor: s.id, rotulo: `${s.nome} · ${s.duracaoMin} min` }))}
          />
          <Select
            rotulo="Profissional"
            vazio="Qualquer um"
            value={profissionalId}
            onChange={(e) => setProfissionalId(e.target.value)}
            opcoes={profissionaisDoServico.map((p) => ({ valor: p.id, rotulo: p.nome }))}
          />
          <Campo rotulo="Dia" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        {servico && <p className="-mt-2 text-xs text-texto-3">{servico.duracaoMin} min · {formatarReais(servico.preco)}</p>}

        <div className="flex flex-col gap-4">
          {livres === null ? (
            <p className="text-sm text-texto-3">Buscando horários livres…</p>
          ) : livres.every((l) => l.horarios.length === 0) ? (
            <div className="flex flex-col items-center gap-3 rounded-xl bg-superficie-2 px-4 py-6 text-center text-sm text-texto-2">
              Sem horário livre nesse dia.
              <Botao variante="secundario" tamanho="p" onClick={() => setData(somarDias(data, 1))}>Ver o dia seguinte</Botao>
            </div>
          ) : (
            livres
              .filter((l) => l.horarios.length > 0)
              .map((l) => (
                <div key={l.profissionalId}>
                  <p className="mb-2 text-[13px] font-medium text-texto-2">{l.profissional}</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {l.horarios.map((h) => {
                      const sel = escolha?.inicio === h && escolha.profissionalId === l.profissionalId;
                      return (
                        <button
                          key={h}
                          aria-pressed={sel}
                          onClick={() => setEscolha({ inicio: h, profissionalId: l.profissionalId })}
                          className={cx(
                            'numero h-9 rounded-lg border text-sm transition-colors',
                            sel ? 'gradiente-atena border-transparent text-white' : 'border-borda bg-superficie hover:border-acento-1',
                          )}
                        >
                          {horaLocal(h, fuso)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      </div>
    </Modal>
  );
}
