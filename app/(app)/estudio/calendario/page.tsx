'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Eye, Pencil, Sparkles, Wand2 } from 'lucide-react';
import { SEGMENTOS, type Pauta, type Segmento } from '@/lib/estudio/calendario';
import type { ModeloPost } from '@/lib/estudio/tipos';
import { chamar, ErroApi } from '../_componentes/cliente';
import { Aviso, Botao, Cartao, Selo, Titulo, Vazio, cx } from '../_componentes/ui';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const ROTULO_MODELO: Record<ModeloPost, string> = { promocao: 'Promoção', novidade: 'Novidade', depoimento: 'Depoimento', 'antes-depois': 'Antes e depois' };
const STATUS: Record<Pauta['status'], { rotulo: string; tom: 'neutro' | 'acento' | 'ok' }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutro' },
  'arte-gerada': { rotulo: 'Arte pronta', tom: 'acento' },
  publicado: { rotulo: 'Publicado', tom: 'ok' },
};

function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function somarMes(mes: string, n: number) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function CalendarioPage() {
  const [mes, setMes] = useState(mesAtual);
  const [pautas, setPautas] = useState<Pauta[] | null>(null);
  const [segmento, setSegmento] = useState<Segmento | ''>('');
  const [dias, setDias] = useState<number[]>([2, 4, 6]);
  const [sugerindo, setSugerindo] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunhoTema, setRascunhoTema] = useState('');

  const carregar = useCallback(() => {
    setPautas(null);
    chamar<{ pautas: Pauta[] }>(`/api/estudio/calendario?mes=${mes}`).then((r) => setPautas(r.pautas)).catch(() => setPautas([]));
  }, [mes]);
  useEffect(carregar, [carregar]);

  async function sugerir(substituir = false) {
    setErro('');
    setSugerindo(true);
    try {
      const r = await chamar<{ pautas: Pauta[] }>('/api/estudio/calendario', { corpo: { mes, segmento: segmento || undefined, diasDaSemana: dias, substituir } });
      setPautas(r.pautas);
      setConfirmar(false);
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) setConfirmar(true);
      else setErro(e instanceof Error ? e.message : 'Não deu certo.');
    } finally {
      setSugerindo(false);
    }
  }

  async function atualizar(p: Pauta, corpo: Partial<Pauta>) {
    try {
      const r = await chamar<{ pauta: Pauta }>(`/api/estudio/calendario/${p.id}`, { metodo: 'PATCH', corpo });
      setPautas((ps) => ps?.map((x) => (x.id === p.id ? r.pauta : x)) ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não deu certo.');
    }
  }

  const [ano, m] = mes.split('-').map(Number);
  const feitos = pautas?.filter((p) => p.status === 'publicado').length ?? 0;

  return (
    <>
      <Titulo titulo="Calendário de conteúdo" descricao="A Atena sugere os posts do mês com as datas que importam para o seu segmento. Cada ideia vira rascunho: ajuste, gere a arte e marque como publicado." />

      <Cartao className="p-4 sm:p-5 mb-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-1">
            <Botao variante="fantasma" className="px-2" onClick={() => setMes(somarMes(mes, -1))} aria-label="Mês anterior"><ChevronLeft className="size-4" /></Botao>
            <h2 className="text-lg min-w-40 text-center"><span className="e-serif capitalize">{MESES[m - 1]}</span> <span className="e-mono text-sm text-[var(--e-suave)]">{ano}</span></h2>
            <Botao variante="fantasma" className="px-2" onClick={() => setMes(somarMes(mes, 1))} aria-label="Próximo mês"><ChevronRight className="size-4" /></Botao>
          </div>
          {pautas && pautas.length > 0 && <span className="text-sm text-[var(--e-suave)]"><span className="e-mono">{feitos}/{pautas.length}</span> publicados</span>}
        </div>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 mt-4 items-end">
          <label className="block">
            <span className="block text-sm font-medium mb-1.5">Segmento</span>
            <select value={segmento} onChange={(e) => setSegmento(e.target.value as Segmento)} className="w-full h-10 rounded-[10px] border border-[var(--e-borda)] bg-[var(--e-cartao)] px-3 text-sm">
              <option value="">O da minha empresa</option>
              {(Object.keys(SEGMENTOS) as Segmento[]).map((s) => <option key={s} value={s}>{SEGMENTOS[s]}</option>)}
            </select>
          </label>
          <fieldset>
            <legend className="text-sm font-medium mb-1.5">Dias de postar</legend>
            <div className="flex gap-1">
              {SEMANA.map((d, i) => (
                <button key={d} type="button" aria-pressed={dias.includes(i)} onClick={() => setDias((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i].sort()))} className={cx('h-10 w-10 rounded-[10px] text-xs border transition', dias.includes(i) ? 'border-[var(--e-acento)] bg-[var(--e-acento-fraco)] font-medium' : 'border-[var(--e-borda)] text-[var(--e-suave)]')}>{d}</button>
              ))}
            </div>
          </fieldset>
          <Botao onClick={() => sugerir(false)} carregando={sugerindo} icone={<Wand2 className="size-4" />}>Sugerir o mês</Botao>
        </div>
        {confirmar && (
          <div className="mt-4"><Aviso tom="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Este mês já tem pautas. Trocar os <b>rascunhos</b> por novas sugestões? O que já tem arte ou foi publicado fica.</span>
              <span className="flex gap-2"><Botao variante="secundario" onClick={() => setConfirmar(false)}>Cancelar</Botao><Botao onClick={() => sugerir(true)} carregando={sugerindo}>Trocar rascunhos</Botao></span>
            </div>
          </Aviso></div>
        )}
        {erro && <div className="mt-4"><Aviso>{erro}</Aviso></div>}
      </Cartao>

      {pautas === null ? (
        <div className="space-y-2">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-20 rounded-[14px] e-esqueleto" />)}</div>
      ) : pautas.length === 0 ? (
        <Cartao><Vazio icone={<CalendarDays className="size-5" />} titulo="Mês sem pautas" texto="Clique em “Sugerir o mês” e a Atena monta o calendário com datas comemorativas e posts de constância." /></Cartao>
      ) : (
        <ol className="space-y-2">
          {pautas.map((p) => {
            const d = new Date(`${p.data}T12:00:00`);
            const st = STATUS[p.status];
            const hrefPost = p.criacaoId ? `/estudio/post?origem=${p.criacaoId}` : `/estudio/post?pauta=${p.id}&modelo=${p.modelo}&tema=${encodeURIComponent(p.tema)}`;
            return (
              <li key={p.id}>
                <Cartao as="article" className={cx('p-4 flex gap-4 items-start transition', p.status === 'publicado' && 'opacity-70')}>
                  <div className="w-14 shrink-0 text-center rounded-[10px] bg-[var(--e-cartao-2)] py-2">
                    <div className="text-[11px] uppercase text-[var(--e-suave)]">{SEMANA[d.getDay()]}</div>
                    <div className="text-xl e-mono leading-none mt-0.5">{d.getDate()}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Selo tom={st.tom}>{st.rotulo}</Selo>
                      <span className="text-xs text-[var(--e-suave)]">{ROTULO_MODELO[p.modelo]} · {p.motivo}</span>
                    </div>
                    {editando === p.id ? (
                      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void atualizar(p, { tema: rascunhoTema }); setEditando(null); }}>
                        <input autoFocus value={rascunhoTema} onChange={(e) => setRascunhoTema(e.target.value)} maxLength={200} className="flex-1 h-9 rounded-[10px] border border-[var(--e-borda)] bg-[var(--e-cartao)] px-3 text-sm" aria-label="Tema do post" />
                        <Botao type="submit" className="h-9">Salvar</Botao>
                      </form>
                    ) : (
                      <p className="text-sm font-medium">{p.tema}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 shrink-0">
                    {editando !== p.id && p.status === 'rascunho' && <Botao variante="fantasma" className="h-9 px-2.5" onClick={() => { setEditando(p.id); setRascunhoTema(p.tema); }} aria-label="Editar tema"><Pencil className="size-4" /></Botao>}
                    <Link href={hrefPost} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm border border-[var(--e-borda)] hover:bg-[var(--e-cartao-2)]">
                      {p.criacaoId ? <><Eye className="size-4" aria-hidden />Ver arte</> : <><Sparkles className="size-4" aria-hidden />Gerar arte</>}
                    </Link>
                    {p.status !== 'publicado' ? (
                      <Botao variante="fantasma" className="h-9 px-3" onClick={() => atualizar(p, { status: 'publicado' })} icone={<Check className="size-4" />}>Publicado</Botao>
                    ) : (
                      <Botao variante="fantasma" className="h-9 px-3" onClick={() => atualizar(p, { status: p.criacaoId ? 'arte-gerada' : 'rascunho' })}>Desfazer</Botao>
                    )}
                  </div>
                </Cartao>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
