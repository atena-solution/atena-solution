'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import { Botao, Campo, Logo, Select, cx, useToast } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { HORARIOS_PADRAO } from '@/lib/base/empresas';
import type { Empresa, HorarioDia, Servico } from '@/lib/tipos';
import { EditorHorarios } from '../configuracoes/_partes/EditorHorarios';
import { SEGMENTOS, TONS } from '../configuracoes/_partes/SEGMENTOS';
import { destinoOnboarding } from '@/lib/planos/onboarding';

const PASSOS = ['Empresa', 'Horários', 'Serviços', 'Marca'];

/** Sugestões de serviços por segmento para começar rápido. */
const SUGESTOES: Record<string, { nome: string; duracaoMin: number; preco: number }[]> = {
  Barbearia: [{ nome: 'Corte', duracaoMin: 30, preco: 50 }, { nome: 'Barba', duracaoMin: 30, preco: 40 }, { nome: 'Corte + barba', duracaoMin: 60, preco: 80 }],
  Estética: [{ nome: 'Limpeza de pele', duracaoMin: 60, preco: 180 }, { nome: 'Design de sobrancelha', duracaoMin: 30, preco: 60 }],
  Clínica: [{ nome: 'Consulta', duracaoMin: 30, preco: 250 }, { nome: 'Retorno', duracaoMin: 20, preco: 0 }],
  Odontologia: [{ nome: 'Avaliação', duracaoMin: 30, preco: 0 }, { nome: 'Limpeza', duracaoMin: 45, preco: 200 }],
  'Salão de beleza': [{ nome: 'Corte feminino', duracaoMin: 60, preco: 120 }, { nome: 'Escova', duracaoMin: 45, preco: 70 }],
  Imobiliária: [{ nome: 'Visita ao imóvel', duracaoMin: 60, preco: 0 }],
  'Escola / Cursos': [{ nome: 'Aula experimental', duracaoMin: 60, preco: 0 }],
};

type LinhaServico = { nome: string; duracaoMin: number | string; preco: number | string };

export function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const nova = params.get('nova') === '1';
  const { sessao, empresa, usuario, api, recarregar, trocarEmpresa } = useSessao();
  const { avisar } = useToast();
  const [passo, setPasso] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const usarExistente = !!sessao && !nova;
  const [dados, setDados] = useState({ nome: '', segmento: '', telefone: '', endereco: '' });
  const [horarios, setHorarios] = useState<HorarioDia[]>(HORARIOS_PADRAO);
  const [servicos, setServicos] = useState<LinhaServico[]>([{ nome: '', duracaoMin: 30, preco: '' }]);
  const [quemAtende, setQuemAtende] = useState('');
  const [marca, setMarca] = useState({ logoUrl: '', cores: { primaria: '#3B5BDB', secundaria: '#7048E8' }, tom: TONS[0] });

  // retoma de onde parou
  useEffect(() => {
    if (!usarExistente || !empresa) return;
    const destino = destinoOnboarding(empresa);
    if (destino !== '/onboarding') {
      // a parte da Base já foi feita (aqui ou no /comecar): não pergunta de novo
      router.replace(destino);
      return;
    }
    setDados({ nome: empresa.nome, segmento: empresa.segmento, telefone: empresa.telefone, endereco: empresa.endereco });
    setHorarios(empresa.horarios);
    setMarca({ ...empresa.marca, tom: empresa.marca.tom || TONS[0] });
    setPasso(1);
  }, [usarExistente, empresa, router]);

  useEffect(() => {
    if (!quemAtende && usuario?.nome) setQuemAtende(usuario.nome);
  }, [usuario, quemAtende]);

  async function avancar() {
    setOcupado(true);
    setErros({});
    try {
      if (passo === 0) {
        if (usarExistente) await api('/api/empresa', { metodo: 'PATCH', corpo: dados });
        else {
          const r = await api<{ empresa: Empresa }>('/api/empresas', { corpo: dados });
          await trocarEmpresa(r.empresa.id);
        }
        const sug = SUGESTOES[dados.segmento];
        if (sug && servicos.length === 1 && !servicos[0].nome) setServicos(sug);
      }
      if (passo === 1) await api('/api/empresa', { metodo: 'PATCH', corpo: { horarios } });
      if (passo === 2) {
        const validos = servicos.filter((s) => String(s.nome).trim());
        const existentes = await api<{ servicos: Servico[] }>('/api/servicos');
        for (const s of validos) {
          if (existentes.servicos.some((x) => x.nome.toLowerCase() === s.nome.trim().toLowerCase())) continue;
          await api('/api/servicos', { corpo: { nome: s.nome, duracaoMin: Number(s.duracaoMin), preco: Number(String(s.preco || 0).replace(',', '.')), descricao: '' } });
        }
        const profs = await api<{ profissionais: unknown[] }>('/api/profissionais');
        if (profs.profissionais.length === 0 && quemAtende.trim()) {
          for (const nome of quemAtende.split(',').map((n) => n.trim()).filter(Boolean)) {
            await api('/api/profissionais', { corpo: { nome, servicosIds: [], horarios: [] } });
          }
        }
      }
      if (passo === 3) {
        await api('/api/empresa', { metodo: 'PATCH', corpo: { marca, onboardingConcluido: true } });
        // o guiado (/comecar) continua do "Treinar a IA", sem repetir empresa, horários e serviços
        await api('/api/cobranca/onboarding', { corpo: { passo: 'servicos', acao: 'feito' } }).catch(() => undefined);
        await recarregar();
        const proximo = destinoOnboarding({ ...empresa, onboardingConcluido: true, onboarding: { feitos: ['conta', 'empresa', 'servicos', ...(empresa?.onboarding?.feitos ?? [])], pulados: empresa?.onboarding?.pulados ?? [] } });
        if (proximo === '/comecar') {
          avisar('Empresa pronta! Agora vamos ensinar a sua atendente de IA.');
          router.replace('/comecar');
        } else {
          avisar('Tudo pronto! Bem-vindo à Atena.');
          router.replace('/inicio');
        }
        return;
      }
      setPasso(passo + 1);
    } catch (x) {
      const err = x as Error & { erros?: Record<string, string> };
      if (err.erros) setErros(err.erros);
      avisar(err.message, 'erro');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-8 md:py-14">
      <div className="mb-10 flex items-center justify-between">
        <Logo />
        {sessao && (
          <button onClick={() => router.push('/inicio')} className="text-sm text-texto-3 hover:text-texto">
            Terminar depois
          </button>
        )}
      </div>

      <ol className="mb-10 flex gap-2" aria-label="Progresso">
        {PASSOS.map((p, i) => (
          <li key={p} className="flex-1">
            <div className={cx('h-1 rounded-full transition-colors duration-300', i <= passo ? 'gradiente-atena' : 'bg-borda')} />
            <p className={cx('mt-2 flex items-center gap-1 text-xs', i === passo ? 'font-medium text-texto' : 'text-texto-3')} aria-current={i === passo ? 'step' : undefined}>
              {i < passo && <Check className="size-3 text-sucesso" aria-hidden />}
              {p}
            </p>
          </li>
        ))}
      </ol>

      <div className="flex-1">
        {passo === 0 && (
          <section className="entrar flex flex-col gap-5">
            <Titulo t="Conte sobre sua empresa." d="Isso ensina a IA a se apresentar e a responder seus clientes." />
            <Campo rotulo="Nome da empresa" value={dados.nome} onChange={(e) => setDados({ ...dados, nome: e.target.value })} erro={erros.nome} autoFocus />
            <Select rotulo="Segmento" vazio="Escolha" value={dados.segmento} onChange={(e) => setDados({ ...dados, segmento: e.target.value })} opcoes={SEGMENTOS.map((s) => ({ valor: s, rotulo: s }))} erro={erros.segmento} />
            <Campo rotulo="WhatsApp da empresa" inputMode="tel" placeholder="(11) 99999-8888" value={dados.telefone} onChange={(e) => setDados({ ...dados, telefone: e.target.value })} erro={erros.telefone} />
            <Campo rotulo="Endereço (opcional)" value={dados.endereco} onChange={(e) => setDados({ ...dados, endereco: e.target.value })} />
          </section>
        )}
        {passo === 1 && (
          <section className="entrar flex flex-col gap-5">
            <Titulo t="Quando vocês atendem?" d="A agenda só oferece horários dentro disto. Dá para ter mais de um turno por dia." />
            <EditorHorarios valor={horarios} aoMudar={setHorarios} />
          </section>
        )}
        {passo === 2 && (
          <section className="entrar flex flex-col gap-5">
            <Titulo t="O que vocês vendem?" d="Serviços ou produtos com duração e preço. A IA nunca inventa nada fora desta lista." />
            <div className="flex flex-col gap-2">
              <div className="hidden grid-cols-[1fr_110px_110px_36px] gap-2 text-xs text-texto-3 sm:grid">
                <span>Serviço</span><span>Duração (min)</span><span>Preço (R$)</span><span />
              </div>
              {servicos.map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_36px] gap-2 sm:grid-cols-[1fr_110px_110px_36px]">
                  <input aria-label="Serviço" placeholder="Ex.: Corte" value={s.nome} onChange={(e) => setServicos(servicos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} className="col-span-3 h-10 rounded-[10px] border border-borda bg-superficie px-3 text-sm focus:border-acento-1 focus:outline-none sm:col-span-1" />
                  <input aria-label="Duração em minutos" type="number" min={5} step={5} value={s.duracaoMin} onChange={(e) => setServicos(servicos.map((x, j) => (j === i ? { ...x, duracaoMin: e.target.value } : x)))} className="numero h-10 rounded-[10px] border border-borda bg-superficie px-3 text-sm focus:border-acento-1 focus:outline-none" />
                  <input aria-label="Preço" inputMode="decimal" placeholder="0,00" value={s.preco} onChange={(e) => setServicos(servicos.map((x, j) => (j === i ? { ...x, preco: e.target.value } : x)))} className="numero h-10 rounded-[10px] border border-borda bg-superficie px-3 text-sm focus:border-acento-1 focus:outline-none" />
                  <button aria-label="Tirar" onClick={() => setServicos(servicos.filter((_, j) => j !== i))} className="flex items-center justify-center text-texto-3 hover:text-erro"><Trash2 className="size-4" /></button>
                </div>
              ))}
              <Botao variante="fantasma" tamanho="p" className="self-start" icone={<Plus className="size-3.5" />} onClick={() => setServicos([...servicos, { nome: '', duracaoMin: 30, preco: '' }])}>
                Outro serviço
              </Botao>
            </div>
            <Campo rotulo="Quem atende?" ajuda="Separe os nomes por vírgula. Cada um ganha uma agenda." value={quemAtende} onChange={(e) => setQuemAtende(e.target.value)} />
          </section>
        )}
        {passo === 3 && (
          <section className="entrar flex flex-col gap-5">
            <Titulo t="A cara da sua marca." d="O Estúdio usa isto nas fotos e posts; a IA usa o tom de voz nas conversas." />
            <Campo rotulo="Link da logo (opcional)" placeholder="https://…" value={marca.logoUrl} onChange={(e) => setMarca({ ...marca, logoUrl: e.target.value })} erro={erros.logo} />
            <div className="flex gap-6">
              {(['primaria', 'secundaria'] as const).map((k) => (
                <label key={k} className="flex items-center gap-3 text-sm">
                  <input type="color" value={marca.cores[k]} onChange={(e) => setMarca({ ...marca, cores: { ...marca.cores, [k]: e.target.value.toUpperCase() } })} className="h-10 w-12 cursor-pointer rounded-lg border border-borda bg-superficie p-1" />
                  Cor {k === 'primaria' ? 'principal' : 'secundária'}
                </label>
              ))}
            </div>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-2 text-[13px] font-medium text-texto-2">Tom de voz</legend>
              {TONS.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-3 rounded-xl border border-borda p-3 text-sm has-[:checked]:border-acento-1 has-[:checked]:bg-acento-1/5">
                  <input type="radio" name="tom" checked={marca.tom === t} onChange={() => setMarca({ ...marca, tom: t })} className="accent-[var(--acento-1)]" />
                  {t}
                </label>
              ))}
            </fieldset>
          </section>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between border-t border-borda pt-6">
        {passo > 0 ? (
          <Botao variante="fantasma" icone={<ArrowLeft className="size-4" />} onClick={() => setPasso(passo - 1)}>Voltar</Botao>
        ) : (
          <span />
        )}
        <Botao tamanho="g" onClick={avancar} carregando={ocupado}>
          {passo === PASSOS.length - 1 ? 'Concluir' : 'Continuar'}
        </Botao>
      </div>
    </div>
  );
}

function Titulo({ t, d }: { t: string; d: string }) {
  return (
    <div className="mb-2">
      <h1 className="titulo-serif text-4xl text-texto">{t}</h1>
      <p className="mt-2 text-sm text-texto-2">{d}</p>
    </div>
  );
}
