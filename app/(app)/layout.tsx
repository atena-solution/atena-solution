import { Casca } from './Casca';

/** Layout de todas as telas logadas. As abas (atendimento, coach, estudio…) entram como pastas aqui dentro. */
export default function LayoutLogado({ children }: { children: React.ReactNode }) {
  return <Casca>{children}</Casca>;
}
