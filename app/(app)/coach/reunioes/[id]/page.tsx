'use client';
// Tela da reunião: player sincronizado com a transcrição, marcadores das objeções e a análise em cartões.
import Link from 'next/link';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Fala, Reuniao } from '@/lib/coach/tipos';
import { falaNoTempo, formatarTempo } from '@/lib/coach/transcricao';
import { api } from '../../_componentes/api';
import { Aviso, Botao, Cartao, Esqueleto, Selo } from '../../_componentes/ui';
import { Player, type AudioPedaco, type ControlePlayer } from '../../_componentes/player';
import { corNota, dataHora, ETAPA, RESULTADO, STATUS } from '../../_componentes/rotulos';

interface Dados { reuniao: Omit<Reuniao, 'pedacos'> & { pedacos: Omit<Reuniao['pedacos'][number], 'falas'>[] }; falas: Fala[]; audios: AudioPedaco[]; podeGerir: boolean; podeEditar: boolean }

export default function PaginaReuniao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [d, setD] = useState<Dados | null>(null);
  const [erro, setErro] = useState('');
  const [analisando, setAnalisando] = useState(false);
  const [atual, setAtual] = useState(-1);
  const player = useRef<ControlePlayer>(null);
  const lista = useRef<HTMLOListElement>(null);
  const seguir = useRef(true);

  const carregar = useCallback(() => api<Dados>(`/api/coach/reunioes/${id}`).then(setD).catch((e: Error) => setErro(e.message)), [id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const aoTempo = useCallback((t: number) => d && setAtual(falaNoTempo(d.falas, t)), [d]);
  useEffect(() => {
    if (atual < 0 || !seguir.current) return;
    lista.current?.querySelector(`[data-i="${atual}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [atual]);

  const marcadores = useMemo(() => (d?.reuniao.analise?.objecoes ?? []).filter((o) => o.momentoSeg !== null).map((o) => ({ seg: o.momentoSeg!, rotulo: o.objecao })), [d]);

  async function analisar() {
    setAnalisando(true);
    setErro('');
    try { await api(`/api/coach/reunioes/${id}/analisar`, { method: 'POST' }); await carregar(); }
    catch (e) { setErro((e as Error).message); }
    finally { setAnalisando(false); }
  }

  async function biblioteca() {
    if (!d) return;
    const r = await api<{ naBiblioteca: boolean }>(`/api/coach/reunioes/${id}`, { method: 'PATCH', body: JSON.stringify({ naBiblioteca: !d.reuniao.naBiblioteca }) });
    setD({ ...d, reuniao: { ...d.reuniao, naBiblioteca: r.naBiblioteca } });
  }

  if (!d) return erro ? <Aviso tom="erro">{erro}</Aviso> : <div className="grid gap-4"><Esqueleto className="h-20" /><Esqueleto className="h-96" /></div>;
  const { reuniao: r, falas } = d;
  const a = r.analise;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/coach" className="text-xs text-[var(--coach-suave)] hover:underline">← Coach</Link>
          <h1 className="titulo-serif mt-1 text-4xl">{r.titulo}</h1>
          <p className="mt-1 text-sm text-[var(--coach-suave)]">
            {r.vendedorNome}{r.contatoNome ? ` com ${r.contatoNome}` : ''} · {dataHora(r.criadoEm)} · <span className="num">{formatarTempo(r.duracaoSeg)}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {a ? <Selo tom={RESULTADO[a.resultado].tom}>{RESULTADO[a.resultado].texto}</Selo> : <Selo>{STATUS[r.status]}</Selo>}
            {r.naBiblioteca && <Selo tom="acento">Na biblioteca</Selo>}
            {a?.simulado && <Selo tom="atencao">Análise simulada</Selo>}
          </div>
        </div>
        {a && (
          <div className="text-right">
            <p className="text-xs text-[var(--coach-suave)]">Nota do vendedor</p>
            <p className="num text-6xl leading-none" style={{ color: corNota(a.nota) }}>{a.nota.toFixed(1)}</p>
          </div>
        )}
      </header>

      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {r.erro && <Aviso tom="erro">{r.erro}</Aviso>}
      {r.semAudioDaAba && <Aviso>Esta reunião veio sem o áudio da aba: só a voz do vendedor foi gravada, então a análise do cliente fica limitada.</Aviso>}
      {!a && falas.length > 0 && d.podeEditar && (
        <Aviso tom="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{r.status === 'gravando' ? 'A gravação não foi encerrada, mas o que foi salvo já pode ser analisado.' : 'Pronta pra analisar.'}</span>
            <Botao variante="principal" onClick={analisar} carregando={analisando}>Analisar agora</Botao>
          </div>
        </Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Cartao>
            <Player ref={player} audios={d.audios} duracaoSeg={r.duracaoSeg} marcadores={marcadores} aoTempo={aoTempo} />
          </Cartao>
          <Cartao titulo="Transcrição" acao={<span className="text-xs text-[var(--coach-suave)]">Clique numa fala pra ouvir</span>}>
            {falas.length === 0 ? (
              <p className="text-sm text-[var(--coach-suave)]">Ainda sem fala transcrita.</p>
            ) : (
              <ol ref={lista} className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto pr-1" onMouseEnter={() => (seguir.current = false)} onMouseLeave={() => (seguir.current = true)}>
                {falas.map((f, i) => (
                  <li key={i} data-i={i}>
                    <button
                      onClick={() => player.current?.irPara(f.inicioSeg)}
                      className={`flex w-full gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors duration-150 ${i === atual ? 'bg-[var(--coach-acento-suave)]' : 'hover:bg-[var(--coach-acento-suave)]/50'} ${f.quem === 'cliente' ? 'pl-6' : ''}`}
                    >
                      <span className="num w-12 shrink-0 pt-0.5 text-xs text-[var(--coach-suave)]">{formatarTempo(f.inicioSeg)}</span>
                      <span>
                        <span className={`mr-1.5 text-xs font-medium ${f.quem === 'vendedor' ? 'text-[var(--coach-acento)]' : 'text-[var(--coach-ok)]'}`}>
                          {f.quem === 'vendedor' ? 'Vendedor' : f.quem === 'cliente' ? 'Cliente' : '—'}
                        </span>
                        {f.texto}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {a ? (
            <>
              <Cartao titulo="Resumo"><p className="text-sm leading-relaxed">{a.resumo}</p></Cartao>
              <div className="grid grid-cols-2 gap-4">
                <Cartao titulo="Chance de fechar"><p className="num text-3xl">{a.chanceFechar}%</p></Cartao>
                <Cartao titulo="Quem falou">
                  <div className="flex h-2 overflow-hidden rounded-full bg-[var(--coach-borda)]" aria-label={`Vendedor ${a.fala.vendedorPct}%, cliente ${a.fala.clientePct}%`}>
                    <div className="bg-[var(--coach-acento)]" style={{ width: `${a.fala.vendedorPct}%` }} />
                    <div className="bg-[var(--coach-ok)]" style={{ width: `${a.fala.clientePct}%` }} />
                  </div>
                  <p className="mt-2 flex justify-between text-xs"><span className="num">Vendedor {a.fala.vendedorPct}%</span><span className="num">Cliente {a.fala.clientePct}%</span></p>
                </Cartao>
              </div>
              <Cartao titulo="Etapas do roteiro">
                <ul className="flex flex-col gap-2.5">
                  {a.etapas.map((e) => (
                    <li key={e.etapaId} className="text-sm">
                      <div className="flex items-center justify-between gap-2"><span className="font-medium">{e.nome}</span><Selo tom={ETAPA[e.status].tom}>{ETAPA[e.status].texto}</Selo></div>
                      {e.comentario && e.comentario !== '(simulado)' && <p className="mt-0.5 text-xs text-[var(--coach-suave)]">{e.comentario}</p>}
                    </li>
                  ))}
                </ul>
              </Cartao>
              <FollowUp id={id} texto={a.followup} />
              {(a.proximoPasso.acao || a.proximoPasso.data) && (
                <Cartao titulo="Próximo passo">
                  <p className="text-sm">{a.proximoPasso.acao}</p>
                  {a.proximoPasso.data && <p className="num mt-1 text-xs text-[var(--coach-suave)]">{new Date(`${a.proximoPasso.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>}
                </Cartao>
              )}
            </>
          ) : (
            <Cartao><p className="text-sm text-[var(--coach-suave)]">A análise aparece aqui quando a reunião for analisada.</p></Cartao>
          )}
        </div>
      </div>

      {a && (
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao titulo="Objeções">
            {a.objecoes.length === 0 ? <p className="text-sm text-[var(--coach-suave)]">Nenhuma objeção nesta reunião.</p> : (
              <ul className="flex flex-col gap-4">
                {a.objecoes.map((o, i) => (
                  <li key={i} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">“{o.objecao}”</span>
                      <span className="flex items-center gap-2">
                        {o.momentoSeg !== null && <button className="num text-xs text-[var(--coach-acento)] underline" onClick={() => player.current?.irPara(o.momentoSeg!)}>{formatarTempo(o.momentoSeg)}</button>}
                        <Selo tom={o.bemRespondida ? 'ok' : 'erro'}>{o.bemRespondida ? 'Bem respondida' : 'Dá pra melhorar'}</Selo>
                      </span>
                    </div>
                    {o.comoRespondeu && <p className="mt-1 text-xs text-[var(--coach-suave)]">Respondeu: {o.comoRespondeu}</p>}
                    {o.comoResponderMelhor && <p className="mt-1">💡 {o.comoResponderMelhor}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
          <Cartao titulo="Diagnóstico do cliente">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {([['Situação', a.diagnostico.situacao], ['Dores', a.diagnostico.dores.join(' · ')], ['Objetivo', a.diagnostico.objetivo], ['Quem decide', a.diagnostico.decisor], ['Orçamento', a.diagnostico.orcamento], ['Urgência', a.diagnostico.urgencia]] as const).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-[var(--coach-suave)]">{k}</dt><dd>{v || '—'}</dd></div>
              ))}
            </dl>
          </Cartao>
          <Cartao titulo="Pontos fortes"><Lista itens={a.pontosFortes} marca="✓" cor="var(--coach-ok)" /></Cartao>
          <Cartao titulo="O que melhorar"><Lista itens={a.melhorar} marca="→" cor="var(--coach-atencao)" /></Cartao>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {d.podeEditar && a && <Botao onClick={analisar} carregando={analisando}>Analisar de novo</Botao>}
        {d.podeGerir && a && <Botao variante="fantasma" onClick={biblioteca}>{r.naBiblioteca ? 'Tirar da biblioteca' : 'Pôr na biblioteca'}</Botao>}
      </div>
    </div>
  );
}

function Lista({ itens, marca, cor }: { itens: string[]; marca: string; cor: string }) {
  if (!itens.length) return <p className="text-sm text-[var(--coach-suave)]">—</p>;
  return <ul className="flex flex-col gap-2 text-sm">{itens.map((x, i) => <li key={i} className="flex gap-2"><span style={{ color: cor }}>{marca}</span>{x}</li>)}</ul>;
}

function FollowUp({ id, texto }: { id: string; texto: string }) {
  const [t, setT] = useState(texto);
  const [estado, setEstado] = useState<{ tom: 'info' | 'erro'; msg: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function mandar() {
    setEnviando(true);
    setEstado(null);
    try {
      const r = await api<{ canal: string; link?: string; enviado?: boolean; pendente?: string }>(`/api/coach/reunioes/${id}/followup`, { method: 'POST', body: JSON.stringify({ texto: t }) });
      if (r.link) window.open(r.link, '_blank', 'noopener');
      else setEstado({ tom: 'info', msg: r.enviado ? 'Enviado pelo WhatsApp da empresa.' : r.pendente ?? 'Pronto.' });
    } catch (e) {
      setEstado({ tom: 'erro', msg: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  }
  return (
    <Cartao titulo="Follow-up pro WhatsApp">
      <textarea rows={5} value={t} onChange={(e) => setT(e.target.value)} className="w-full rounded-[10px] border border-[var(--coach-borda)] bg-transparent p-3 text-sm outline-none focus:border-[var(--coach-acento)]" aria-label="Mensagem de follow-up" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Botao variante="principal" onClick={mandar} carregando={enviando} disabled={!t.trim()}>Mandar follow-up</Botao>
        <Botao variante="fantasma" onClick={() => navigator.clipboard.writeText(t).then(() => setEstado({ tom: 'info', msg: 'Copiado.' }))}>Copiar</Botao>
      </div>
      {estado && <p className={`mt-2 text-xs ${estado.tom === 'erro' ? 'text-[var(--coach-erro)]' : 'text-[var(--coach-suave)]'}`}>{estado.msg}</p>}
    </Cartao>
  );
}
