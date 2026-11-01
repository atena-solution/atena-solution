import Link from 'next/link';
import { Logo } from './Logo';
import { MARCA, SEGMENTOS } from '../_conteudo';

export function Rodape() {
  return (
    <footer className="s-divisor" style={{ background: 'var(--s-fundo-2)' }}>
      <div className="s-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="s-texto-2 mt-4 text-sm leading-relaxed">{MARCA.frase}</p>
        </div>
        <div>
          <p className="s-sobretitulo mb-3">Produto</p>
          <ul className="grid gap-2 text-sm s-texto-2">
            <li><Link href="/#produto">Atendimento</Link></li>
            <li><Link href="/#produto">Coach de Vendas</Link></li>
            <li><Link href="/#produto">Estúdio</Link></li>
            <li><Link href="/precos">Preços</Link></li>
          </ul>
        </div>
        <div>
          <p className="s-sobretitulo mb-3">Para</p>
          <ul className="grid gap-2 text-sm s-texto-2">
            {SEGMENTOS.map((s) => <li key={s.slug}><Link href={`/para/${s.slug}`}>{s.nome}</Link></li>)}
          </ul>
        </div>
        <div>
          <p className="s-sobretitulo mb-3">Empresa</p>
          <ul className="grid gap-2 text-sm s-texto-2">
            <li><Link href="/termos">Termos de uso</Link></li>
            <li><Link href="/privacidade">Privacidade (LGPD)</Link></li>
            <li><a href={`mailto:${MARCA.emailContato}`}>{MARCA.emailContato}</a></li>
          </ul>
        </div>
      </div>
      <div className="s-container flex flex-col gap-2 py-6 text-xs s-texto-3 md:flex-row md:justify-between" style={{ borderTop: '1px solid var(--s-borda)' }}>
        <span>© {new Date().getFullYear()} ATENA SOLUTION. Todos os direitos reservados.</span>
        <span>Feito no Brasil.</span>
      </div>
    </footer>
  );
}
