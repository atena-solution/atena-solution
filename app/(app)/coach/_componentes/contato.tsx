'use client';
// Peças do Coach pra ficha do contato (Contatos, sessão A) e pro Início.
// Uso na ficha:  <BotaoGravarReuniao contato={{ id, nome, telefone }} />  e  <ReunioesDoContato contatoId={id} />
// Uso no Início: <CartaoCoachInicio />
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Reuniao } from '@/lib/coach/tipos';
import { api } from './api';
import { Selo } from './ui';
import { ArrowRight, Mic } from 'lucide-react';
import { Cartao as CartaoBase, CabecalhoCartao, CorpoCartao, Esqueleto } from '@/app/ui';
import { nota, corNota, dataCurta, RESULTADO, STATUS } from './rotulos';

export function BotaoGravarReuniao({ contato }: { contato: { id: string; nome?: string; telefone?: string } }) {
  const q = new URLSearchParams({ contatoId: contato.id, ...(contato.nome ? { nome: contato.nome } : {}), ...(contato.telefone ? { telefone: contato.telefone } : {}) });
  return (
    <Link href={`/coach/gravar?${q}`} className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-borda bg-superficie px-4 text-sm font-medium hover:bg-superficie-2">
      <span className="h-2 w-2 rounded-full bg-erro" aria-hidden /> Gravar reunião
    </Link>
  );
}

type Leve = Omit<Reuniao, 'pedacos'> & { pedacos: number };

/** Reuniões do Coach com este contato (cartão na ficha). Some quando não há reunião. */
export function ReunioesDoContato({ contatoId }: { contatoId: string }) {
  const [lista, setLista] = useState<Leve[] | null>(null);
  useEffect(() => {
    api<{ reunioes: Leve[] }>(`/api/coach/reunioes?contatoId=${encodeURIComponent(contatoId)}`).then((d) => setLista(d.reunioes)).catch(() => setLista([]));
  }, [contatoId]);
  if (!lista?.length) return null;
  return (
    <CartaoBase>
      <CabecalhoCartao icone={<Mic className="text-coach" />} titulo="Reuniões de venda" descricao="Gravadas e analisadas no Coach." />
      <CorpoCartao className="flex flex-col gap-2">
        {lista.map((r) => (
          <Link key={r.id} href={`/coach/reunioes/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-borda px-3 py-2.5 text-sm hover:bg-superficie-2">
            <span className="min-w-0 truncate">{dataCurta(r.criadoEm)} · {r.vendedorNome}</span>
            {r.analise ? (
              <span className="flex shrink-0 items-center gap-2"><Selo tom={RESULTADO[r.analise.resultado].tom}>{RESULTADO[r.analise.resultado].texto}</Selo><span className="numero" style={{ color: corNota(r.analise.nota) }}>{nota(r.analise.nota)}</span></span>
            ) : <Selo>{STATUS[r.status]}</Selo>}
          </Link>
        ))}
      </CorpoCartao>
    </CartaoBase>
  );
}

export function CartaoCoachInicio() {
  const [d, setD] = useState<{ reunioesHoje: number; notaMediaSemana: number | null; fechamentosSemana: number } | null>(null);
  const [erro, setErro] = useState(false);
  useEffect(() => { api<NonNullable<typeof d>>('/api/coach/placar?resumo=1').then(setD).catch(() => setErro(true)); }, []);
  return (
    <CartaoBase>
      <CabecalhoCartao
        icone={<Mic className="text-coach" />}
        titulo="Coach de Vendas"
        descricao="Reuniões e notas da equipe"
        acao={<Link href="/coach" className="inline-flex items-center gap-1 text-[13px] font-medium text-acento hover:underline">Abrir <ArrowRight className="size-3.5" /></Link>}
      />
      <CorpoCartao>
        {erro ? (
          <p className="text-sm text-texto-3">Sem dados do Coach.</p>
        ) : !d ? (
          <Esqueleto className="h-16 w-full" />
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3">
              <div><dt className="text-xs text-texto-3">Reuniões hoje</dt><dd className="numero text-lg text-texto">{d.reunioesHoje}</dd></div>
              <div><dt className="text-xs text-texto-3">Nota da semana</dt><dd className="numero text-lg" style={{ color: corNota(d.notaMediaSemana) }}>{nota(d.notaMediaSemana)}</dd></div>
              <div><dt className="text-xs text-texto-3">Fechamentos</dt><dd className="numero text-lg text-texto">{d.fechamentosSemana}</dd></div>
            </dl>
            <Link href="/coach/gravar" className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg border border-borda bg-superficie px-3 text-[13px] font-medium hover:bg-superficie-2">
              <span className="size-2 rounded-full bg-erro" aria-hidden /> Gravar reunião
            </Link>
          </>
        )}
      </CorpoCartao>
    </CartaoBase>
  );
}
