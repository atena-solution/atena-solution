import { tabelaComparacao, listarPlanos } from '@/lib/planos/preco';
import { IcoCheck, IcoTraco } from './Icones';

export function Comparacao() {
  const planos = listarPlanos();
  const linhas = tabelaComparacao();
  return (
    <div className="s-card relative overflow-x-auto">
      <table className="s-tabela min-w-[640px]">
        <caption className="sr-only">Comparação dos planos</caption>
        <thead>
          <tr>
            <th scope="col" className="s-texto-3">Recurso</th>
            {planos.map((p) => <th scope="col" key={p.id}>{p.nome}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.recurso}>
              <th scope="row" className="font-normal s-texto-2">{l.recurso}</th>
              {planos.map((p) => {
                const v = l.valores[p.id];
                return (
                  <td key={p.id}>
                    {v === true ? <IcoCheck className="s-check mx-auto" /> : v === false ? <IcoTraco className="mx-auto s-texto-3" /> : <span className="s-mono text-sm">{v}</span>}
                    <span className="sr-only">{v === true ? 'Incluso' : v === false ? 'Não incluso' : ''}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
