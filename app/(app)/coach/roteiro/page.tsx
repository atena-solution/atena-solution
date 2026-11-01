'use client';
// /coach/roteiro — etapas da reunião, perguntas-chave e objeções com a resposta ideal. Modelo pronto por segmento.
import { useEffect, useState } from 'react';
import type { ConfigCoach, Resultado, Roteiro } from '@/lib/coach/tipos';
import { api } from '../_componentes/api';
import { Aviso, Botao, Campo, Cartao, classeEntrada, Esqueleto } from '../_componentes/ui';
import { RESULTADO } from '../_componentes/rotulos';

interface Resp { roteiro: Roteiro; ehModelo: boolean; segmentos: { id: string; nome: string }[] }
const ETAPAS_FUNIL = ['Novo', 'Em conversa', 'Agendado', 'Compareceu', 'Cliente', 'Perdido'];

export default function PaginaRoteiro() {
  const [r, setR] = useState<Roteiro | null>(null);
  const [ehModelo, setEhModelo] = useState(false);
  const [segmentos, setSegmentos] = useState<Resp['segmentos']>([]);
  const [config, setConfig] = useState<ConfigCoach | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tom: 'info' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    api<Resp>('/api/coach/roteiro').then((d) => { setR(d.roteiro); setEhModelo(d.ehModelo); setSegmentos(d.segmentos); }).catch((e: Error) => setMsg({ tom: 'erro', texto: e.message }));
    api<{ config: ConfigCoach }>('/api/coach/config').then((d) => setConfig(d.config)).catch(() => {});
  }, []);

  async function usarModelo(seg: string) {
    if (!confirm('Trocar o roteiro atual pelo modelo? O que você editou e não salvou se perde.')) return;
    const d = await api<Resp>(`/api/coach/roteiro?modelo=${seg}`);
    setR(d.roteiro);
  }

  async function salvar() {
    if (!r) return;
    setSalvando(true);
    setMsg(null);
    try {
      const d = await api<{ roteiro: Roteiro }>('/api/coach/roteiro', { method: 'PUT', body: JSON.stringify(r) });
      setR(d.roteiro);
      setEhModelo(false);
      if (config) await api('/api/coach/config', { method: 'PUT', body: JSON.stringify(config) });
      setMsg({ tom: 'info', texto: 'Roteiro salvo. As próximas análises usam esta versão.' });
    } catch (e) {
      setMsg({ tom: 'erro', texto: (e as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  if (!r) return msg ? <Aviso tom="erro">{msg.texto}</Aviso> : <Esqueleto className="h-96" />;

  const mudarEtapa = (i: number, campo: 'nome' | 'objetivo' | 'perguntasChave', v: string) =>
    setR({ ...r, etapas: r.etapas.map((e, j) => (j === i ? { ...e, [campo]: campo === 'perguntasChave' ? v.split('\n') : v } : e)) });
  const mover = (i: number, d: -1 | 1) => {
    const e = [...r.etapas];
    const [x] = e.splice(i, 1);
    e.splice(Math.max(0, Math.min(e.length, i + d)), 0, x);
    setR({ ...r, etapas: e });
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-serif text-4xl">Roteiro de vendas</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--coach-suave)]">A IA dá a nota comparando cada reunião com este roteiro. Escreva do jeito que sua equipe fala.</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Começar com modelo" className={`${classeEntrada} w-auto`} defaultValue="" onChange={(e) => e.target.value && usarModelo(e.target.value)}>
            <option value="" disabled>Usar modelo pronto…</option>
            {segmentos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <Botao variante="principal" onClick={salvar} carregando={salvando}>Salvar roteiro</Botao>
        </div>
      </header>

      {ehModelo && <Aviso tom="info">Este é um modelo pronto pro seu segmento. Ajuste e clique em “Salvar roteiro”.</Aviso>}
      {msg && <Aviso tom={msg.tom}>{msg.texto}</Aviso>}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-[var(--coach-suave)]">Etapas da reunião</h2>
        {r.etapas.map((e, i) => (
          <Cartao key={i}>
            <div className="grid gap-4 md:grid-cols-[auto_1fr_1fr]">
              <div className="flex items-start gap-1 md:flex-col">
                <span className="num flex h-8 w-8 items-center justify-center rounded-full bg-[var(--coach-acento-suave)] text-sm text-[var(--coach-acento)]">{i + 1}</span>
                <Botao variante="fantasma" className="px-2 py-1" aria-label="Subir etapa" onClick={() => mover(i, -1)} disabled={i === 0}>↑</Botao>
                <Botao variante="fantasma" className="px-2 py-1" aria-label="Descer etapa" onClick={() => mover(i, 1)} disabled={i === r.etapas.length - 1}>↓</Botao>
              </div>
              <div className="flex flex-col gap-3">
                <Campo rotulo="Etapa"><input className={classeEntrada} value={e.nome} onChange={(x) => mudarEtapa(i, 'nome', x.target.value)} /></Campo>
                <Campo rotulo="O que o vendedor precisa conseguir"><input className={classeEntrada} value={e.objetivo} onChange={(x) => mudarEtapa(i, 'objetivo', x.target.value)} /></Campo>
              </div>
              <Campo rotulo="Perguntas-chave" dica="Uma por linha.">
                <textarea rows={4} className={classeEntrada} value={e.perguntasChave.join('\n')} onChange={(x) => mudarEtapa(i, 'perguntasChave', x.target.value)} />
              </Campo>
            </div>
            <div className="mt-2 text-right">
              <Botao variante="fantasma" onClick={() => setR({ ...r, etapas: r.etapas.filter((_, j) => j !== i) })}>Remover etapa</Botao>
            </div>
          </Cartao>
        ))}
        <div><Botao onClick={() => setR({ ...r, etapas: [...r.etapas, { id: '', nome: 'Nova etapa', objetivo: '', perguntasChave: [] }] })}>+ Adicionar etapa</Botao></div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-[var(--coach-suave)]">Objeções comuns e a resposta ideal</h2>
        <Cartao>
          <div className="flex flex-col divide-y divide-[var(--coach-borda)]">
            {r.objecoes.map((o, i) => (
              <div key={i} className="grid gap-3 py-3 md:grid-cols-[1fr_2fr_auto]">
                <input aria-label="Objeção" className={classeEntrada} value={o.objecao} onChange={(x) => setR({ ...r, objecoes: r.objecoes.map((y, j) => (j === i ? { ...y, objecao: x.target.value } : y)) })} />
                <textarea aria-label="Resposta ideal" rows={2} className={classeEntrada} value={o.respostaIdeal} onChange={(x) => setR({ ...r, objecoes: r.objecoes.map((y, j) => (j === i ? { ...y, respostaIdeal: x.target.value } : y)) })} />
                <Botao variante="fantasma" aria-label="Remover objeção" onClick={() => setR({ ...r, objecoes: r.objecoes.filter((_, j) => j !== i) })}>✕</Botao>
              </div>
            ))}
          </div>
          <Botao className="mt-3" onClick={() => setR({ ...r, objecoes: [...r.objecoes, { id: '', objecao: '', respostaIdeal: '' }] })}>+ Adicionar objeção</Botao>
        </Cartao>
      </section>

      {config && (
        <Cartao titulo="Funil de contatos">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={config.moverEtapa} onChange={(e) => setConfig({ ...config, moverEtapa: e.target.checked })} className="h-4 w-4 accent-[var(--coach-acento)]" />
            Mover o contato no funil pelo resultado da reunião
          </label>
          {config.moverEtapa && (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {(Object.keys(RESULTADO) as Resultado[]).map((k) => (
                <Campo key={k} rotulo={RESULTADO[k].texto}>
                  <select className={classeEntrada} value={config.etapaPorResultado[k] ?? ''} onChange={(e) => setConfig({ ...config, etapaPorResultado: { ...config.etapaPorResultado, [k]: e.target.value } })}>
                    <option value="">Não mover</option>
                    {ETAPAS_FUNIL.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Campo>
              ))}
            </div>
          )}
        </Cartao>
      )}

      <div className="flex justify-end"><Botao variante="principal" onClick={salvar} carregando={salvando}>Salvar roteiro</Botao></div>
    </div>
  );
}
