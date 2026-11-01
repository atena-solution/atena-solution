'use client';
// Onboarding guiado: conta → empresa → serviços e horários → treinar a IA → WhatsApp (ou pular) → pronto.
// Usa as rotas da Base (empresas, empresa, serviços) e /api/cobranca/{teste,onboarding}. Dá pra parar e voltar.

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { observarUsuario, type UsuarioCliente } from '@/lib/auth/cliente';
import { chamarApi } from '@/lib/sessao';
import { PASSOS, SEGMENTOS, horariosPadrao, perguntasRapidas, validarEmpresa, validarServicos, type EstadoOnboarding, type HorarioRascunho, type Passo } from '@/lib/planos/onboarding';
import { obterPlano } from '@/lib/planos/preco';
import { CONFIG_PLANOS } from '@/lib/planos/config';
import { formatarDataBR } from '@/lib/planos/datas';
import { IcoCheck, IcoMais, IcoFechar } from '../_componentes/Icones';

type Erros = Record<string, string>;
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function Campo({ rotulo, erro, dica, children }: { rotulo: string; erro?: string; dica?: string; children: React.ReactNode }) {
  return (
    <div className="s-campo">
      <label>{rotulo}</label>
      {children}
      {erro ? <span className="s-erro" role="alert">{erro}</span> : dica ? <span className="s-dica">{dica}</span> : null}
    </div>
  );
}

function Assistente() {
  const router = useRouter();
  const params = useSearchParams();
  const planoUrl = params.get('plano');
  const plano = planoUrl ? obterPlano(planoUrl) : undefined;

  const [usuario, setUsuario] = useState<UsuarioCliente | null | undefined>(undefined);
  const [temEmpresa, setTemEmpresa] = useState<boolean | null>(null);
  const [segmento, setSegmento] = useState('');
  const [estado, setEstado] = useState<EstadoOnboarding | null>(null);
  const [passo, setPasso] = useState<Passo>('empresa');
  const [testeAte, setTesteAte] = useState<string | undefined>();
  const [erroGeral, setErroGeral] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => observarUsuario(setUsuario), []);

  const carregar = useCallback(async () => {
    try {
      const s = await chamarApi<{ sessao: unknown; empresa?: { segmento?: string } }>('/api/sessao');
      if (!s.sessao) { setTemEmpresa(false); setPasso('empresa'); return; }
      setTemEmpresa(true);
      setSegmento(SEGMENTOS.find((x) => x.nome === s.empresa?.segmento)?.id ?? 'outro');
      const o = await chamarApi<{ estado: EstadoOnboarding; proximo: Passo }>('/api/cobranca/onboarding');
      setEstado(o.estado);
      setPasso(o.proximo);
      const c = await chamarApi<{ assinatura?: { testeAte?: string } }>('/api/cobranca').catch(() => null);
      setTesteAte(c?.assinatura?.testeAte);
    } catch (e) {
      setErroGeral((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (usuario === null) router.replace(`/entrar?criar=1&voltar=${encodeURIComponent(`/comecar${planoUrl ? `?plano=${planoUrl}` : ''}`)}`);
    else if (usuario) carregar();
  }, [usuario, router, planoUrl, carregar]);

  async function avancar(p: Passo, acao: 'feito' | 'pular', extra?: object) {
    const r = await chamarApi<{ estado: EstadoOnboarding; proximo: Passo }>('/api/cobranca/onboarding', { corpo: { passo: p, acao, ...extra } });
    setEstado(r.estado);
    setPasso(r.proximo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function executar(f: () => Promise<void>) {
    setErroGeral('');
    setOcupado(true);
    try { await f(); } catch (e) { setErroGeral((e as Error).message); } finally { setOcupado(false); }
  }

  const feitos = useMemo(() => new Set([...(estado?.feitos ?? []), ...(temEmpresa ? (['conta', 'empresa'] as Passo[]) : ['conta' as Passo])]), [estado, temEmpresa]);
  const pct = Math.round((PASSOS.filter((p) => p.id !== 'pronto' && (feitos.has(p.id) || estado?.pulados.includes(p.id))).length / (PASSOS.length - 1)) * 100);

  if (usuario === undefined || temEmpresa === null) {
    return <div className="grid min-h-[60vh] place-items-center s-texto-3" role="status">Carregando…</div>;
  }

  return (
    <div className="s-container max-w-3xl py-10 md:py-14">
      <div className="mb-8 flex items-center justify-between gap-4">
        <p className="s-sobretitulo">Criar sua conta</p>
        {temEmpresa && passo !== 'pronto' && <Link href="/inicio" className="text-sm s-texto-2 underline underline-offset-4">Parar e continuar depois</Link>}
      </div>

      {/* Barra de progresso */}
      <div className="mb-3 flex items-center justify-between text-xs s-texto-3">
        <span>Passo {Math.min(PASSOS.findIndex((p) => p.id === passo) + 1, PASSOS.length)} de {PASSOS.length}</span>
        <span className="s-mono">{pct}%</span>
      </div>
      <div className="s-progresso" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do cadastro"><div style={{ width: `${pct}%` }} /></div>
      <ol className="mt-4 hidden gap-2 text-xs md:flex">
        {PASSOS.map((p) => {
          const ok = feitos.has(p.id);
          const pulou = estado?.pulados.includes(p.id);
          return (
            <li key={p.id} className="flex items-center gap-1.5" style={{ color: p.id === passo ? 'var(--s-texto)' : 'var(--s-texto-3)', fontWeight: p.id === passo ? 600 : 400 }}>
              {ok ? <IcoCheck tamanho={14} className="s-check" /> : <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: pulou ? 'var(--s-ambar)' : 'currentColor' }} />}
              {p.titulo}
              <span className="mx-1 s-texto-3">·</span>
            </li>
          );
        })}
      </ol>

      {erroGeral && <p className="mt-6 rounded-xl px-4 py-3 text-sm" role="alert" style={{ background: 'color-mix(in srgb, var(--s-vermelho) 10%, transparent)', color: 'var(--s-vermelho)' }}>{erroGeral}</p>}

      <div className="mt-10">
        {passo === 'empresa' && (
          <PassoEmpresa ocupado={ocupado} plano={plano?.nome} onSalvar={(dados) => executar(async () => {
            if (!temEmpresa) {
              const r = await chamarApi<{ empresa: { id: string } }>('/api/empresas', { corpo: dados });
              try { localStorage.setItem('atena:empresa', r.empresa.id); } catch {}
              const t = await chamarApi<{ testeAte?: string }>('/api/cobranca/teste', { corpo: { planoId: plano?.id } });
              setTesteAte(t.testeAte);
              setTemEmpresa(true);
            } else {
              await chamarApi('/api/empresa', { metodo: 'PATCH', corpo: dados });
            }
            setSegmento(SEGMENTOS.find((x) => x.nome === dados.segmento)?.id ?? 'outro');
            await avancar('empresa', 'feito');
          })} />
        )}

        {passo === 'servicos' && (
          <PassoServicos ocupado={ocupado} onSalvar={(servicos, horarios) => executar(async () => {
            await chamarApi('/api/empresa', { metodo: 'PATCH', corpo: { horarios } });
            for (const s of servicos) await chamarApi('/api/servicos', { corpo: { nome: s.nome, duracaoMin: s.duracaoMin, preco: s.preco / 100, descricao: '' } });
            await avancar('servicos', 'feito');
          })} />
        )}

        {passo === 'treinar' && (
          <PassoTreinar segmento={segmento} ocupado={ocupado}
            onSalvar={(treino) => executar(() => avancar('treinar', 'feito', { treino }))}
            onPular={() => executar(() => avancar('treinar', 'pular'))} />
        )}

        {passo === 'whatsapp' && (
          <section>
            <h1 className="s-titulo-l">Conecte o seu WhatsApp</h1>
            <p className="s-texto-2 mt-3 max-w-xl">Use o mesmo número que seus clientes já conhecem, pela API oficial do WhatsApp (Meta). Leva uns 10 minutos e a gente guia passo a passo. Antes de ligar a IA, você testa tudo no simulador.</p>
            <ul className="mt-6 grid gap-2 text-sm">
              {['Ter acesso ao Facebook da empresa (Gerenciador de Negócios)', 'O número não pode estar em uso no app comum do WhatsApp Business ao mesmo tempo', 'Tenha o celular do número por perto para receber o código'].map((t) => <li key={t} className="flex gap-2.5"><IcoCheck className="s-check" />{t}</li>)}
            </ul>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button className="s-btn s-btn-primario" disabled={ocupado} onClick={() => executar(async () => { await avancar('whatsapp', 'feito'); router.push('/configuracoes/whatsapp'); })}>Conectar agora</button>
              <button className="s-btn s-btn-secundario" disabled={ocupado} onClick={() => executar(() => avancar('whatsapp', 'pular'))}>Fazer depois</button>
            </div>
          </section>
        )}

        {passo === 'pronto' && (
          <section className="text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full text-white" style={{ background: 'var(--s-degrade)' }}><IcoCheck tamanho={30} /></span>
            <h1 className="s-titulo-l mt-6">Tudo pronto!</h1>
            <p className="s-texto-2 mx-auto mt-3 max-w-md">
              Seu teste grátis{testeAte ? ` vai até ${formatarDataBR(testeAte)}` : ` é de ${CONFIG_PLANOS.testeGratisDias} dias`}, com todas as abas liberadas.
              {estado?.pulados.length ? ' O que você pulou fica no Início para fazer quando quiser.' : ''}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/inicio" className="s-btn s-btn-primario">Ir para o Início</Link>
              <Link href="/atendimento/treinar" className="s-btn s-btn-secundario">Testar a IA no simulador</Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function PassoEmpresa({ onSalvar, ocupado, plano }: { onSalvar: (d: { nome: string; segmento: string; telefone: string; endereco: string }) => void; ocupado: boolean; plano?: string }) {
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [erros, setErros] = useState<Erros>({});
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const er = validarEmpresa({ nome, segmento, telefone });
      setErros(er);
      if (!Object.keys(er).length) onSalvar({ nome: nome.trim(), segmento: SEGMENTOS.find((s) => s.id === segmento)!.nome, telefone, endereco: endereco.trim() });
    }} noValidate>
      <h1 className="s-titulo-l">Conte sobre a sua empresa</h1>
      <p className="s-texto-2 mt-3">{plano ? `Você escolheu ${plano}. ` : ''}Durante o teste, todas as abas ficam liberadas.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <Campo rotulo="Nome da empresa" erro={erros.nome}><input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="organization" placeholder="Ex.: Barbearia Topetes" /></Campo>
        <Campo rotulo="Segmento" erro={erros.segmento}>
          <select value={segmento} onChange={(e) => setSegmento(e.target.value)}>
            <option value="">Escolha…</option>
            {SEGMENTOS.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="WhatsApp / telefone" erro={erros.telefone} dica="Com DDD."><input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" /></Campo>
        <Campo rotulo="Endereço (opcional)" dica="A IA usa para responder “onde fica?”."><input value={endereco} onChange={(e) => setEndereco(e.target.value)} autoComplete="street-address" /></Campo>
      </div>
      <button className="s-btn s-btn-primario mt-8" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Continuar'}</button>
    </form>
  );
}

type LinhaServico = { nome: string; duracaoMin: string; preco: string };

function PassoServicos({ onSalvar, ocupado }: { onSalvar: (s: { nome: string; duracaoMin: number; preco: number }[], h: HorarioRascunho[]) => void; ocupado: boolean }) {
  const [linhas, setLinhas] = useState<LinhaServico[]>([{ nome: '', duracaoMin: '30', preco: '' }]);
  const [horarios, setHorarios] = useState<HorarioRascunho[]>(horariosPadrao());
  const [erros, setErros] = useState<Erros>({});
  const dia = (d: number) => horarios.find((h) => h.dia === d);
  const mudarDia = (d: number, campo: 'abre' | 'fecha' | 'ativo', v: string | boolean) => {
    if (campo === 'ativo') setHorarios((hs) => (v ? [...hs, { dia: d, abre: '09:00', fecha: '18:00' }].sort((a, b) => a.dia - b.dia) : hs.filter((h) => h.dia !== d)));
    else setHorarios((hs) => hs.map((h) => (h.dia === d ? { ...h, [campo]: v as string } : h)));
  };
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const servicos = linhas.filter((l) => l.nome.trim() || l.preco).map((l) => ({ nome: l.nome.trim(), duracaoMin: Number(l.duracaoMin), preco: Math.round(Number(l.preco.replace(/\./g, '').replace(',', '.') || 0) * 100) }));
      const er = validarServicos(servicos, horarios);
      setErros(er);
      if (!Object.keys(er).length) onSalvar(servicos, horarios);
    }} noValidate>
      <h1 className="s-titulo-l">Serviços e horários</h1>
      <p className="s-texto-2 mt-3">A IA só fala os preços e serviços que estão aqui. Você ajusta tudo depois na Agenda.</p>

      <h2 className="s-titulo-m mt-10">O que você vende</h2>
      {erros.servicos && <p className="s-erro mt-2 text-sm" style={{ color: 'var(--s-vermelho)' }}>{erros.servicos}</p>}
      <div className="mt-4 grid gap-3">
        {linhas.map((l, i) => (
          <div key={i} className="s-card grid gap-3 p-4 sm:grid-cols-[1fr_120px_140px_auto] sm:items-end">
            <Campo rotulo="Serviço ou produto" erro={erros[`servicos.${i}.nome`]}><input value={l.nome} onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} placeholder="Ex.: Corte + barba" /></Campo>
            <Campo rotulo="Duração (min)" erro={erros[`servicos.${i}.duracaoMin`]}><input value={l.duracaoMin} inputMode="numeric" onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, duracaoMin: e.target.value.replace(/\D/g, '') } : x)))} /></Campo>
            <Campo rotulo="Preço (R$)" erro={erros[`servicos.${i}.preco`]}><input value={l.preco} inputMode="decimal" placeholder="70,00" onChange={(e) => setLinhas((ls) => ls.map((x, j) => (j === i ? { ...x, preco: e.target.value.replace(/[^\d,.]/g, '') } : x)))} /></Campo>
            <button type="button" className="s-btn s-btn-secundario s-btn-pequeno" aria-label={`Remover serviço ${i + 1}`} disabled={linhas.length === 1} onClick={() => setLinhas((ls) => ls.filter((_, j) => j !== i))}><IcoFechar tamanho={16} /></button>
          </div>
        ))}
      </div>
      <button type="button" className="s-btn s-btn-secundario s-btn-pequeno mt-3" onClick={() => setLinhas((ls) => [...ls, { nome: '', duracaoMin: '30', preco: '' }])}><IcoMais tamanho={16} /> Adicionar outro</button>

      <h2 className="s-titulo-m mt-10">Quando você atende</h2>
      {erros.horarios && <p className="mt-2 text-sm" style={{ color: 'var(--s-vermelho)' }}>{erros.horarios}</p>}
      <div className="s-card mt-4 divide-y" style={{ borderColor: 'var(--s-borda)' }}>
        {DIAS.map((nomeDia, d) => {
          const h = dia(d);
          const i = horarios.findIndex((x) => x.dia === d);
          return (
            <div key={d} className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderColor: 'var(--s-borda)' }}>
              <label className="flex w-24 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={!!h} onChange={(e) => mudarDia(d, 'ativo', e.target.checked)} /> {nomeDia}
              </label>
              {h ? (
                <span className="flex items-center gap-2 text-sm">
                  <input type="time" aria-label={`${nomeDia}: abre`} value={h.abre} onChange={(e) => mudarDia(d, 'abre', e.target.value)} className="rounded-lg px-2 py-1.5 s-mono" style={{ border: '1px solid var(--s-borda-forte)', background: 'var(--s-superficie)', color: 'var(--s-texto)' }} />
                  até
                  <input type="time" aria-label={`${nomeDia}: fecha`} value={h.fecha} onChange={(e) => mudarDia(d, 'fecha', e.target.value)} className="rounded-lg px-2 py-1.5 s-mono" style={{ border: '1px solid var(--s-borda-forte)', background: 'var(--s-superficie)', color: 'var(--s-texto)' }} />
                </span>
              ) : <span className="text-sm s-texto-3">Fechado</span>}
              {i >= 0 && erros[`horarios.${i}`] && <span className="w-full text-xs" style={{ color: 'var(--s-vermelho)' }}>{erros[`horarios.${i}`]}</span>}
            </div>
          );
        })}
      </div>
      <button className="s-btn s-btn-primario mt-8" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Continuar'}</button>
    </form>
  );
}

function PassoTreinar({ segmento, onSalvar, onPular, ocupado }: { segmento: string; onSalvar: (t: object) => void; onPular: () => void; ocupado: boolean }) {
  const perguntas = perguntasRapidas(segmento);
  const [nomeAssistente, setNome] = useState('');
  const [tom, setTom] = useState(perguntas[1].opcoes![0]);
  const [faq, setFaq] = useState([{ pergunta: '', resposta: '' }, { pergunta: '', resposta: '' }, { pergunta: '', resposta: '' }]);
  const [nuncaDizer, setNunca] = useState('');
  const [quandoChamarHumano, setHumano] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSalvar({ nomeAssistente, tom, perguntas: faq, nuncaDizer, quandoChamarHumano }); }}>
      <h1 className="s-titulo-l">Treine a sua IA</h1>
      <p className="s-texto-2 mt-3">Cinco perguntas rápidas. Ela começa desligada: você testa no simulador antes de responder clientes de verdade.</p>
      <div className="mt-8 grid gap-6">
        <Campo rotulo={perguntas[0].pergunta} dica={perguntas[0].dica}><input value={nomeAssistente} onChange={(e) => setNome(e.target.value)} placeholder="Lia" /></Campo>
        <fieldset className="s-campo">
          <legend className="mb-2 text-[0.85rem] font-semibold">{perguntas[1].pergunta}</legend>
          <div className="flex flex-wrap gap-2">
            {perguntas[1].opcoes!.map((o) => (
              <button type="button" key={o} aria-pressed={tom === o} onClick={() => setTom(o)} className="s-btn s-btn-pequeno" style={{ border: '1px solid', borderColor: tom === o ? 'var(--s-violeta)' : 'var(--s-borda-forte)', background: tom === o ? 'color-mix(in srgb, var(--s-violeta) 10%, transparent)' : 'transparent' }}>{o}</button>
            ))}
          </div>
        </fieldset>
        <div className="s-campo">
          <label>{perguntas[2].pergunta}</label>
          <span className="s-dica">{perguntas[2].dica}</span>
          <div className="mt-2 grid gap-3">
            {faq.map((f, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <input aria-label={`Pergunta ${i + 1}`} placeholder={`Pergunta ${i + 1}`} value={f.pergunta} onChange={(e) => setFaq((l) => l.map((x, j) => (j === i ? { ...x, pergunta: e.target.value } : x)))} />
                <input aria-label={`Resposta ${i + 1}`} placeholder="Resposta" value={f.resposta} onChange={(e) => setFaq((l) => l.map((x, j) => (j === i ? { ...x, resposta: e.target.value } : x)))} />
              </div>
            ))}
          </div>
        </div>
        <Campo rotulo={perguntas[3].pergunta} dica={`${perguntas[3].dica} Uma por linha.`}><textarea value={nuncaDizer} onChange={(e) => setNunca(e.target.value)} /></Campo>
        <Campo rotulo={perguntas[4].pergunta} dica={`${perguntas[4].dica} Uma por linha.`}><textarea value={quandoChamarHumano} onChange={(e) => setHumano(e.target.value)} /></Campo>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button className="s-btn s-btn-primario" disabled={ocupado}>{ocupado ? 'Salvando…' : 'Salvar e continuar'}</button>
        <button type="button" className="s-btn s-btn-secundario" disabled={ocupado} onClick={onPular}>Pular por agora</button>
      </div>
    </form>
  );
}

export default function Comecar() {
  return <Suspense><Assistente /></Suspense>;
}
