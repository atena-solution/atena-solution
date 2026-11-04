'use client';
// Plano e créditos da empresa: situação, pagar, trocar plano, comprar créditos, extrato.
import { useState } from 'react';
import { CreditCard, RefreshCw, Sparkles, Receipt, Check } from 'lucide-react';
import { Botao, Cabecalho, Cartao, CabecalhoCartao, CorpoCartao, Campo, Selo, Modal, Esqueleto, useToast, cx, type TomSelo } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import type { SituacaoAcesso, Fase } from '@/lib/planos/acesso';
import type { PacoteCreditos, Plano, PlanoId } from '@/lib/planos/config';
import type { MovimentoCredito } from '@/lib/planos/creditos';
import { calcularPreco, formatarReais, planoTemVendedores, type Ciclo } from '@/lib/planos/preco';
import { formatarDataBR } from '@/lib/planos/datas';
import { documentoValido } from '@/lib/cobranca/documento';

interface Resposta {
  situacao: SituacaoAcesso;
  saldo: number;
  assinatura: null | {
    planoId: PlanoId; vendedores: number; ciclo: Ciclo; testeAte?: string; pagoAte?: string; canceladaEm?: string;
    temCadastroPagador: boolean; assinaturaAtiva: boolean; faturaAbertaUrl?: string; valorAtual: number;
  };
  extrato: MovimentoCredito[];
  pagamentos: { pagamentoId: string; tipo: string; efeito: string; valor: number; status: string; quando: string; creditos?: number }[];
  planos: Plano[];
  pacotes: PacoteCreditos[];
  simulado: boolean;
  perfectpay?: boolean;
}

const FASE: Record<Fase, { rotulo: string; tom: TomSelo }> = {
  sem_plano: { rotulo: 'Sem plano', tom: 'neutro' },
  teste: { rotulo: 'Teste grátis', tom: 'acento' },
  ativa: { rotulo: 'Ativo', tom: 'sucesso' },
  carencia: { rotulo: 'Pagamento pendente', tom: 'atencao' },
  somente_leitura: { rotulo: 'Só leitura', tom: 'erro' },
};

const r = (c: number) => formatarReais(c, { semCentavosQuandoInteiro: true });

type Pedido = { tipo: 'plano'; planoId: PlanoId } | { tipo: 'creditos'; pacoteId: string };

export function PainelPlano({ embutido = false }: { embutido?: boolean }) {
  const { sessao, api, recarregar: recarregarSessao } = useSessao();
  const { avisar } = useToast();
  const { dados, erro, recarregar } = useDados<Resposta>('/api/cobranca');
  const [ciclo, setCiclo] = useState<Ciclo>('mensal');
  const [vendedores, setVendedores] = useState(3);
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const dono = sessao?.papel === 'dono';
  const financeiro = dono || sessao?.papel === 'gestor';

  if (erro) return <p className="p-6 text-sm text-erro">{erro}</p>;
  if (!dados) return <div className="grid gap-4 p-6"><Esqueleto className="h-32" /><Esqueleto className="h-64" /></div>;

  const { situacao, assinatura } = dados;
  const planoAtual = dados.planos.find((p) => p.id === assinatura?.planoId);

  async function abrirFatura(url?: string) {
    if (url) window.open(url, '_blank', 'noopener');
  }

  async function confirmar(pagador?: { nome: string; cpfCnpj: string }) {
    if (!pedido) return;
    setOcupado('pedido');
    try {
      const res = pedido.tipo === 'plano'
        ? await api<{ faturaUrl?: string }>('/api/cobranca/assinar', { corpo: { planoId: pedido.planoId, vendedores, ciclo, pagador } })
        : await api<{ faturaUrl?: string }>('/api/cobranca/creditos', { corpo: { pacoteId: pedido.pacoteId, pagador } });
      setPedido(null);
      avisar(pedido.tipo === 'plano' ? 'Cobrança gerada. O plano libera assim que o pagamento for confirmado.' : 'Cobrança gerada. Os créditos entram assim que o pagamento for confirmado.', 'sucesso');
      abrirFatura(res.faturaUrl);
      recarregar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setOcupado(null);
    }
  }

  async function jaPaguei() {
    setOcupado('sync');
    try {
      const res = await api<{ liberou: boolean }>('/api/cobranca/sincronizar', { metodo: 'POST' });
      avisar(res.liberou ? 'Pagamento confirmado. Tudo liberado!' : 'Ainda não recebemos a confirmação. Pix cai em minutos; boleto pode levar até 3 dias úteis.', res.liberou ? 'sucesso' : 'info');
      recarregar();
      if (res.liberou) recarregarSessao();
    } finally {
      setOcupado(null);
    }
  }

  async function cancelar() {
    if (!confirm('Cancelar a renovação? Você continua usando até o fim do período já pago.')) return;
    const viaPP = !!dados?.perfectpay;
    setOcupado('cancelar');
    try {
      const res = await api<{ usaAte?: string }>('/api/cobranca/cancelar', { metodo: 'POST' });
      avisar(`Renovação cancelada. Você usa até ${res.usaAte ? formatarDataBR(res.usaAte) : 'o fim do período'}.${viaPP ? ' Para parar a cobrança no cartão, cancele também pelo link do e-mail da Perfect Pay.' : ''}`, 'info');
      recarregar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className={embutido ? 'w-full' : 'mx-auto w-full max-w-5xl'}>
      {!embutido && <Cabecalho titulo="Plano e créditos" descricao="Seu plano, pagamentos e créditos do Estúdio." />}
      {dados.simulado && <p className="mb-4 rounded-lg border border-atencao/30 bg-atencao/10 px-3 py-2 text-xs text-atencao">Modo simulado: as faturas abrem uma página de teste (nada é cobrado de verdade).</p>}

      {/* Situação */}
      <Cartao>
        <CabecalhoCartao icone={<CreditCard />} titulo={planoAtual ? (situacao.fase === 'teste' ? 'Teste grátis — todas as abas' : planoAtual.nome) : 'Sem plano'}
          descricao={situacao.liberadoAte ? `${situacao.fase === 'teste' ? 'Teste até' : situacao.fase === 'somente_leitura' ? 'Venceu em' : assinatura?.canceladaEm ? 'Usa até' : 'Pago até'} ${formatarDataBR(situacao.liberadoAte)}` : undefined}
          acao={<Selo tom={FASE[situacao.fase].tom} ponto>{FASE[situacao.fase].rotulo}</Selo>} />
        <CorpoCartao className="grid gap-4">
          {situacao.aviso && <p className={cx('text-sm', situacao.aviso.tom === 'erro' ? 'text-erro' : situacao.aviso.tom === 'atencao' ? 'text-atencao' : 'text-texto-2')}>{situacao.aviso.texto}</p>}
          {assinatura?.assinaturaAtiva && <p className="text-sm text-texto-2">Valor: <span className="font-mono">{r(assinatura.valorAtual)}</span> por {assinatura.ciclo === 'anual' ? 'ano' : 'mês'}{assinatura.vendedores ? ` · ${assinatura.vendedores} vendedores` : ''}</p>}
          {financeiro && (
            <div className="flex flex-wrap gap-2">
              {assinatura?.faturaAbertaUrl && <Botao onClick={() => abrirFatura(assinatura.faturaAbertaUrl)} icone={<Receipt className="size-4" />}>Pagar agora</Botao>}
              {assinatura?.assinaturaAtiva && <Botao variante="secundario" carregando={ocupado === 'sync'} onClick={jaPaguei} icone={<RefreshCw className="size-4" />}>Já paguei</Botao>}
              {dono && assinatura?.assinaturaAtiva && <Botao variante="fantasma" carregando={ocupado === 'cancelar'} onClick={cancelar}>Cancelar renovação</Botao>}
            </div>
          )}
        </CorpoCartao>
      </Cartao>

      {/* Planos */}
      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight">{assinatura?.assinaturaAtiva ? 'Trocar de plano' : 'Escolha seu plano'}</h2>
            <p className="text-[13px] text-texto-2">Sem fidelidade. A troca vale a partir da próxima cobrança.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] text-texto-2">Vendedores
              <input type="number" min={1} value={vendedores} onChange={(e) => setVendedores(Math.max(1, Number(e.target.value) || 1))} className="h-9 w-16 rounded-lg border border-borda bg-superficie px-2 text-center font-mono text-sm" />
            </label>
            <div className="flex rounded-[10px] border border-borda bg-superficie-2 p-0.5" role="group" aria-label="Ciclo">
              {(['mensal', 'anual'] as Ciclo[]).map((c) => (
                <button key={c} aria-pressed={ciclo === c} onClick={() => setCiclo(c)} className={cx('h-8 rounded-lg px-3 text-[13px] font-medium', ciclo === c ? 'bg-superficie text-texto shadow-[var(--sombra)]' : 'text-texto-2')}>{c === 'mensal' ? 'Mensal' : 'Anual'}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {dados.planos.map((p) => {
            const o = calcularPreco({ planoId: p.id, vendedores, ciclo });
            const atual = assinatura?.assinaturaAtiva && assinatura.planoId === p.id;
            return (
              <Cartao key={p.id} className={cx('flex flex-col p-5', p.maisEscolhido && 'ring-1 ring-acento-2/40')}>
                <div className="flex items-center justify-between"><h3 className="font-semibold">{p.nome}</h3>{atual && <Selo tom="sucesso">Atual</Selo>}</div>
                <p className="mt-1 min-h-[36px] text-[13px] text-texto-2">{p.chamada}</p>
                <p className="mt-4"><span className="text-2xl font-semibold">{r(o.equivalenteMensal)}</span><span className="text-[13px] text-texto-3">/mês</span></p>
                <p className="min-h-[18px] text-xs text-texto-3">{ciclo === 'anual' ? `${r(o.valorCobrado)}/ano` : ''}{planoTemVendedores(p) ? ` · ${o.vendedores} vend.` : ''}</p>
                <ul className="mt-3 grid flex-1 gap-1.5 text-[13px] text-texto-2">
                  {p.destaques.slice(0, 3).map((d) => <li key={d} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-sucesso" />{d}</li>)}
                </ul>
                <Botao className="mt-4" larguraTotal variante={p.maisEscolhido ? 'primario' : 'secundario'} disabled={!dono} title={dono ? undefined : 'Só o dono contrata'} onClick={() => setPedido({ tipo: 'plano', planoId: p.id })}>
                  {atual ? 'Atualizar' : 'Assinar'}
                </Botao>
              </Cartao>
            );
          })}
        </div>
      </section>

      {/* Créditos */}
      <section className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Cartao>
          <CabecalhoCartao icone={<Sparkles />} titulo="Créditos do Estúdio" descricao="Fotos, posts e vídeos usam créditos. Não expiram enquanto houver plano." />
          <CorpoCartao>
            <p className="font-mono text-4xl font-light">{dados.saldo}</p>
            <p className="text-[13px] text-texto-3">créditos disponíveis</p>
            <div className="mt-5 grid gap-2">
              {dados.pacotes.map((p) => (
                <button key={p.id} disabled={!financeiro} onClick={() => setPedido({ tipo: 'creditos', pacoteId: p.id })}
                  className="flex items-center justify-between rounded-[10px] border border-borda px-3 py-2.5 text-sm transition-colors hover:border-borda-forte hover:bg-superficie-2 disabled:opacity-50">
                  <span><span className="font-mono">+{p.creditos}</span> créditos</span><span className="font-medium">{r(p.preco)}</span>
                </button>
              ))}
            </div>
          </CorpoCartao>
        </Cartao>
        <Cartao>
          <CabecalhoCartao titulo="Extrato" descricao="Últimos movimentos de créditos." />
          <CorpoCartao>
            {dados.extrato.length === 0 ? <p className="text-sm text-texto-3">Nenhum movimento ainda.</p> : (
              <ul className="divide-y divide-borda text-sm">
                {dados.extrato.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0"><span className="block truncate">{m.descricao}</span><span className="text-xs text-texto-3">{formatarDataBR(m.quando)}</span></span>
                    <span className={cx('font-mono', m.quantidade >= 0 ? 'text-sucesso' : 'text-texto-2')}>{m.quantidade >= 0 ? '+' : ''}{m.quantidade}</span>
                  </li>
                ))}
              </ul>
            )}
          </CorpoCartao>
        </Cartao>
      </section>

      {financeiro && dados.pagamentos.length > 0 && (
        <Cartao className="mt-4">
          <CabecalhoCartao titulo="Pagamentos" />
          <CorpoCartao>
            <ul className="divide-y divide-borda text-sm">
              {dados.pagamentos.map((p) => (
                <li key={p.pagamentoId} className="flex items-center justify-between gap-3 py-2">
                  <span>{p.tipo === 'assinatura' ? 'Mensalidade' : `Créditos (+${p.creditos ?? 0})`} · <span className="text-texto-3">{formatarDataBR(p.quando)}</span></span>
                  <span className="flex items-center gap-2"><span className="font-mono">{r(Math.round(p.valor * 100))}</span><Selo tom={p.efeito === 'estornado' ? 'erro' : 'sucesso'}>{p.efeito === 'estornado' ? 'Estornado' : 'Pago'}</Selo></span>
                </li>
              ))}
            </ul>
          </CorpoCartao>
        </Cartao>
      )}

      <ModalPagador pedido={pedido} precisaDados={!assinatura?.temCadastroPagador} ocupado={ocupado === 'pedido'} aoFechar={() => setPedido(null)} aoConfirmar={confirmar}
        resumo={pedido?.tipo === 'plano' ? (() => { const o = calcularPreco({ planoId: pedido.planoId, vendedores, ciclo }); return `${dados.planos.find((x) => x.id === pedido.planoId)?.nome} · ${r(o.valorCobrado)} por ${ciclo === 'anual' ? 'ano' : 'mês'}`; })()
          : pedido ? (() => { const p = dados.pacotes.find((x) => x.id === pedido.pacoteId); return p ? `${p.creditos} créditos · ${r(p.preco)}` : ''; })() : ''} />
    </div>
  );
}

function ModalPagador({ pedido, precisaDados, ocupado, aoFechar, aoConfirmar, resumo }: {
  pedido: Pedido | null; precisaDados: boolean; ocupado: boolean; resumo: string;
  aoFechar: () => void; aoConfirmar: (p?: { nome: string; cpfCnpj: string }) => void;
}) {
  const [nome, setNome] = useState('');
  const [doc, setDoc] = useState('');
  const [erro, setErro] = useState('');
  return (
    <Modal aberto={!!pedido} aoFechar={aoFechar} titulo="Confirmar" descricao={resumo} largura="p"
      rodape={<div className="flex justify-end gap-2"><Botao variante="fantasma" onClick={aoFechar}>Voltar</Botao>
        <Botao carregando={ocupado} onClick={() => {
          if (!precisaDados) return aoConfirmar();
          if (nome.trim().length < 2) return setErro('Informe o nome.');
          if (!documentoValido(doc)) return setErro('CPF ou CNPJ inválido.');
          setErro('');
          aoConfirmar({ nome, cpfCnpj: doc });
        }}>Gerar cobrança</Botao></div>}>
      <div className="grid gap-4">
        {precisaDados && (
          <>
            <p className="text-[13px] text-texto-2">Para emitir a cobrança (e a nota), precisamos destes dados uma vez só.</p>
            <Campo rotulo="Nome ou razão social" value={nome} onChange={(e) => setNome(e.target.value)} />
            <Campo rotulo="CPF ou CNPJ" value={doc} inputMode="numeric" onChange={(e) => setDoc(e.target.value)} erro={erro || undefined} />
          </>
        )}
        <p className="text-[13px] text-texto-2">Você escolhe Pix, boleto ou cartão no pagamento seguro (abre em outra aba). O acesso libera assim que o pagamento for confirmado.</p>
      </div>
    </Modal>
  );
}
