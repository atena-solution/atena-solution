import { PERGUNTAS } from '../_conteudo';
import { IcoMais } from './Icones';

export function Perguntas({ itens = PERGUNTAS }: { itens?: { p: string; r: string }[] }) {
  return (
    <div className="s-faq" style={{ borderTop: '1px solid var(--s-borda)' }}>
      {itens.map((q) => (
        <details key={q.p}>
          <summary><span>{q.p}</span><span><IcoMais /></span></summary>
          <p>{q.r}</p>
        </details>
      ))}
    </div>
  );
}
