'use client';

import Link from 'next/link';
import { MessageCircle, CalendarCheck, UserX, UserPlus, ArrowRight, Bot, CheckCircle2, Circle } from 'lucide-react';
import { Avatar, Cartao, CabecalhoCartao, CorpoCartao, Esqueleto, Selo, Vazio } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import type { ResumoDoDia } from '@/lib/inicio/resumo';
import { saudacao } from '@/lib/inicio/resumo';
import { horaLocal } from '@/lib/agenda/fuso';
import { NOME_STATUS, TOM_STATUS } from '@/lib/agenda/horarios';
import { tempoRelativo } from '@/lib/ui/formato';
import { CARTOES_DAS_ABAS } from './cartoes-das-abas';

interface RespostaInicio {
  resumo: ResumoDoDia;
  fuso: string;
  totalContatos: number;
  contatos: { id: string; nome: string }[];
  servicos: { id: string; nome: string }[];
  profissionais: { id: string; nome: string }[];
  novosContatos: { id: string; nome: string; origem: string; criadoEm: string }[];
  configurado: { servicos: boolean; profissionais: boolean; contatos: boolean };
}

function Numero({ titulo, valor, detalhe, icone, cor, href, aoVivo }: { titulo: string; valor: number; detalhe?: string; icone: React.ReactNode; cor: string; href: string; aoVivo?: boolean }) {
  return (
    <Link href={href} className="group">
      <Cartao className="h-full p-5 transition-colors group-hover:border-borda-forte">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[13px] font-medium text-texto-2">
            <span style={{ color: cor }} className="[&>svg]:size-4">{icone}</span>
            {titulo}
          </span>
          {aoVivo && <Selo tom="atendimento" aoVivo>ao vivo</Selo>}
        </div>
        <p className="numero mt-4 text-4xl text-texto">{valor}</p>
        {detalhe && <p className="mt-1 text-xs text-texto-3">{detalhe}</p>}
      </Cartao>
    </Link>
  );
}

export function PainelInicio() {
  const { empresa, membro } = useSessao();
  const { dados } = useDados<RespostaInicio>('/api/inicio');
  const fuso = empresa?.fuso ?? 'America/Sao_Paulo';
  const agora = new Date();
  const primeiroNome = (membro?.nome ?? '').split(' ')[0];
  const cartoesExtras = CARTOES_DAS_ABAS.filter((c) => empresa?.plano.abas.includes(c.aba));

  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-texto-3 first-letter:uppercase">{agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: fuso })}</p>
        <h1 className="titulo-serif mt-1 text-4xl text-texto md:text-5xl">
          {saudacao(agora, fuso)}{primeiroNome ? `, ${primeiroNome}` : ''}.
        </h1>
      </div>

      {!dados ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Esqueleto key={i} className="h-36 rounded-cartao" />)}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Numero
              titulo="Conversas abertas"
              valor={dados.resumo.conversasAbertas}
              detalhe={dados.resumo.precisamDeHumano ? `${dados.resumo.precisamDeHumano} ${dados.resumo.precisamDeHumano === 1 ? "precisa" : "precisam"} de você` : 'A IA está cuidando'}
              icone={<MessageCircle />}
              cor="var(--aba-atendimento)"
              href="/atendimento"
              aoVivo={dados.resumo.conversasAbertas > 0}
            />
            <Numero
              titulo="Agendamentos hoje"
              valor={dados.resumo.agendamentosHoje}
              detalhe={`${dados.resumo.confirmadosHoje} confirmados · ${dados.resumo.compareceramHoje} já vieram`}
              icone={<CalendarCheck />}
              cor="var(--acento-1)"
              href="/agenda"
            />
            <Numero titulo="Faltas hoje" valor={dados.resumo.faltasHoje} detalhe={dados.resumo.faltasHoje ? 'Vale chamar para remarcar' : 'Ninguém faltou'} icone={<UserX />} cor="var(--erro)" href="/agenda" />
            <Numero titulo="Novos contatos" valor={dados.resumo.novosContatosHoje} detalhe={`${dados.totalContatos} no total`} icone={<UserPlus />} cor="var(--sucesso)" href="/contatos" />
          </div>

          {(!dados.configurado.servicos || !dados.configurado.profissionais || !dados.configurado.contatos) && (
            <Cartao>
              <CabecalhoCartao titulo="Deixe a Atena pronta" descricao="Três passos para a IA começar a marcar horários sozinha." />
              <CorpoCartao className="grid gap-2 sm:grid-cols-3">
                {[
                  { ok: dados.configurado.servicos, t: 'Cadastrar serviços e preços', href: '/configuracoes?aba=servicos' },
                  { ok: dados.configurado.profissionais, t: 'Adicionar quem atende', href: '/configuracoes?aba=profissionais' },
                  { ok: dados.configurado.contatos, t: 'Importar seus clientes', href: '/contatos' },
                ].map((p) => (
                  <Link key={p.t} href={p.href} className="flex items-center gap-2.5 rounded-xl border border-borda px-3.5 py-3 text-sm hover:bg-superficie-2">
                    {p.ok ? <CheckCircle2 className="size-4 text-sucesso" /> : <Circle className="size-4 text-texto-3" />}
                    <span className={p.ok ? 'text-texto-3 line-through' : ''}>{p.t}</span>
                  </Link>
                ))}
              </CorpoCartao>
            </Cartao>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Cartao>
              <CabecalhoCartao titulo="Próximos horários de hoje" acao={<Link href="/agenda" className="flex items-center gap-1 text-sm text-acento">Agenda <ArrowRight className="size-3.5" /></Link>} />
              <CorpoCartao className="flex flex-col gap-2">
                {dados.resumo.proximos.length === 0 ? (
                  <Vazio titulo="Nada mais por hoje" descricao="Quando alguém marcar, aparece aqui." className="py-8" />
                ) : (
                  dados.resumo.proximos.map((a) => (
                    <Link key={a.id} href={`/agenda?ver=${a.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-superficie-2">
                      <span className="numero w-12 text-sm">{horaLocal(a.inicio, fuso)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{dados.contatos.find((c) => c.id === a.contatoId)?.nome ?? 'Cliente'}</span>
                        <span className="block truncate text-xs text-texto-3">
                          {dados.servicos.find((s) => s.id === a.servicoId)?.nome} · {dados.profissionais.find((p) => p.id === a.profissionalId)?.nome}
                        </span>
                      </span>
                      {a.criadoPor === 'ia' && <Bot className="size-4 text-atendimento" aria-label="Marcado pela IA" />}
                      <Selo tom={TOM_STATUS[a.status]}>{NOME_STATUS[a.status]}</Selo>
                    </Link>
                  ))
                )}
              </CorpoCartao>
            </Cartao>

            <Cartao>
              <CabecalhoCartao titulo="Chegaram por último" acao={<Link href="/contatos" className="flex items-center gap-1 text-sm text-acento">Contatos <ArrowRight className="size-3.5" /></Link>} />
              <CorpoCartao className="flex flex-col gap-1">
                {dados.novosContatos.length === 0 ? (
                  <Vazio titulo="Ninguém ainda" descricao="Novos clientes do WhatsApp entram aqui." className="py-8" />
                ) : (
                  dados.novosContatos.map((c) => (
                    <Link key={c.id} href={`/contatos/${c.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-superficie-2">
                      <Avatar nome={c.nome} tamanho="p" />
                      <span className="min-w-0 flex-1 truncate text-sm">{c.nome}</span>
                      <span className="text-xs text-texto-3">{c.origem} · {tempoRelativo(c.criadoEm)}</span>
                    </Link>
                  ))
                )}
              </CorpoCartao>
            </Cartao>
          </div>

          {cartoesExtras.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {cartoesExtras.map(({ aba, Componente }) => <Componente key={aba} />)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
