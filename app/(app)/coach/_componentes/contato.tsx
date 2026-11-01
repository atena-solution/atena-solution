'use client';
// Peças do Coach pra ficha do contato (Contatos, sessão A) e pro Início.
// Uso na ficha:  <BotaoGravarReuniao contato={{ id, nome, telefone }} />  e  <ReunioesDoContato contatoId={id} />
// Uso no Início: <CartaoCoachInicio />
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Reuniao } from '@/lib/coach/tipos';
import { api } from './api';
import { Cartao, Selo } from './ui';
import { nota, corNota, dataCurta, RESULTADO, STATUS } from './rotulos';

export function BotaoGravarReuniao({ contato }: { contato: { id: string; nome?: string; telefone?: string } }) {
  const q = new URLSearchParams({ contatoId: contato.id, ...(contato.nome ? { nome: contato.nome } : {}), ...(contato.telefone ? { telefone: contato.telefone } : {}) });
  return (
    <Link href={`/coach/gravar?${q}`} className="inline-flex items-center gap-2 rounded-[10px] border border-borda bg-superficie px-3 py-1.5 text-sm hover:border-coach">
      <span className="h-2 w-2 rounded-full bg-erro" aria-hidden /> Gravar reunião
    </Link>
  );
}

type Leve = Omit<Reuniao, 'pedacos'> & { pedacos: number };

export function ReunioesDoContato({ contatoId }: { contatoId: string }) {
  const [lista, setLista] = useState<Leve[] | null>(null);
  useEffect(() => {
    api<{ reunioes: Leve[] }>(`/api/coach/reunioes?contatoId=${encodeURIComponent(contatoId)}`).then((d) => setLista(d.reunioes)).catch(() => setLista([]));
  }, [contatoId]);
  if (!lista?.length) return null;
  return (
    <ul className="flex flex-col gap-2">
      {lista.map((r) => (
        <li key={r.id}>
          <Link href={`/coach/reunioes/${r.id}`} className="flex items-center justify-between gap-3 text-sm hover:underline">
            <span>Reunião · {dataCurta(r.criadoEm)} · {r.vendedorNome}</span>
            {r.analise ? (
              <span className="flex items-center gap-2"><Selo tom={RESULTADO[r.analise.resultado].tom}>{RESULTADO[r.analise.resultado].texto}</Selo><span className="numero" style={{ color: corNota(r.analise.nota) }}>{nota(r.analise.nota)}</span></span>
            ) : <Selo>{STATUS[r.status]}</Selo>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CartaoCoachInicio() {
  const [d, setD] = useState<{ reunioesHoje: number; notaMediaSemana: number | null; fechamentosSemana: number } | null>(null);
  useEffect(() => { api<typeof d>('/api/coach/placar?resumo=1').then(setD).catch(() => {}); }, []);
  return (
    <Cartao titulo="Coach" acao={<Link href="/coach" className="text-xs font-medium text-coach hover:underline">Abrir</Link>}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="numero text-2xl">{d?.reunioesHoje ?? '—'}</p><p className="text-xs text-texto-2">reuniões hoje</p></div>
        <div><p className="numero text-2xl" style={{ color: corNota(d?.notaMediaSemana) }}>{nota(d?.notaMediaSemana)}</p><p className="text-xs text-texto-2">nota da semana</p></div>
        <div><p className="numero text-2xl">{d?.fechamentosSemana ?? '—'}</p><p className="text-xs text-texto-2">fechamentos</p></div>
      </div>
    </Cartao>
  );
}
