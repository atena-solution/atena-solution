import type { Metadata } from 'next';
import { CONFIG_PLANOS } from '@/lib/planos/config';
import { formatarReais } from '@/lib/planos/preco';
import { Precos } from '../_componentes/Precos';
import { Comparacao } from '../_componentes/Comparacao';
import { Perguntas } from '../_componentes/Perguntas';
import { ChamadaFinal } from '../_componentes/ChamadaFinal';
import { PERGUNTAS } from '../_conteudo';

export const metadata: Metadata = { title: 'Preços', description: 'Planos da ATENA SOLUTION: Atendimento, Coach de Vendas, Estúdio e Pacote completo. Teste grátis de 7 dias.' };

export default function PaginaPrecos() {
  const faq = PERGUNTAS.filter((q) => /teste|pago|cancel|créditos|só uma aba/i.test(q.p));
  return (
    <>
      <section className="s-secao">
        <div className="s-container">
          <div className="text-center">
            <p className="s-sobretitulo">Preços</p>
            <h1 className="s-titulo-xl mt-3">Pague pelo que usa.</h1>
            <p className="s-texto-2 mx-auto mt-4 max-w-xl text-lg">Cada aba é um plano. O pacote junta tudo com desconto. {CONFIG_PLANOS.testeGratisDias} dias grátis, sem cartão.</p>
          </div>
          <div className="mt-12"><Precos /></div>
        </div>
      </section>

      <section className="s-secao s-divisor">
        <div className="s-container">
          <h2 className="s-titulo-l">Compare os planos</h2>
          <div className="mt-8"><Comparacao /></div>
        </div>
      </section>

      <section className="s-secao s-divisor" style={{ background: 'var(--s-fundo-2)' }}>
        <div className="s-container">
          <p className="s-sobretitulo">Estúdio</p>
          <h2 className="s-titulo-l mt-3">Créditos extras quando precisar.</h2>
          <p className="s-texto-2 mt-3 max-w-2xl">Cada foto, post ou vídeo gerado usa créditos. Os planos com Estúdio já vêm com créditos todo mês. Precisa de mais? Compre um pacote, pelo painel. Créditos não expiram enquanto você tiver plano.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {CONFIG_PLANOS.pacotesCreditos.map((p) => (
              <div key={p.id} className="s-card p-6">
                <p className="s-mono text-3xl">{p.creditos}</p>
                <p className="s-texto-3 text-sm">créditos</p>
                <p className="mt-4 text-xl font-semibold">{formatarReais(p.preco, { semCentavosQuandoInteiro: true })}</p>
                <p className="s-texto-3 text-xs">{formatarReais(Math.round(p.preco / p.creditos))} por crédito</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="s-secao s-divisor">
        <div className="s-container grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <h2 className="s-titulo-l">Dúvidas sobre o pagamento</h2>
          <Perguntas itens={faq} />
        </div>
      </section>
      <ChamadaFinal />
    </>
  );
}
