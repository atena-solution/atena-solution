import type { AbaContratavel } from './tipos';

export interface ItemNavegacao {
  id: string;
  rotulo: string;
  href: string;
  /** Nome do ícone lucide (resolvido na tela). */
  icone: 'inicio' | 'atendimento' | 'contatos' | 'agenda' | 'coach' | 'estudio' | 'configuracoes';
  /** Aba contratável: só aparece liberada se estiver no plano. */
  aba?: AbaContratavel;
  /** Cor de destaque discreta da aba (token Tailwind). */
  cor?: 'atendimento' | 'coach' | 'estudio';
  /** Aparece no menu inferior do celular. */
  celular?: boolean;
}

/** Ordem oficial da barra lateral. "/" é do site público (sessão E); o Início logado fica em /inicio. */
export const NAVEGACAO: ItemNavegacao[] = [
  { id: 'inicio', rotulo: 'Início', href: '/inicio', icone: 'inicio', celular: true },
  { id: 'atendimento', rotulo: 'Atendimento', href: '/atendimento', icone: 'atendimento', aba: 'atendimento', cor: 'atendimento', celular: true },
  { id: 'contatos', rotulo: 'Contatos', href: '/contatos', icone: 'contatos', celular: true },
  { id: 'agenda', rotulo: 'Agenda', href: '/agenda', icone: 'agenda', celular: true },
  { id: 'coach', rotulo: 'Coach', href: '/coach', icone: 'coach', aba: 'coach', cor: 'coach' },
  { id: 'estudio', rotulo: 'Estúdio', href: '/estudio', icone: 'estudio', aba: 'estudio', cor: 'estudio' },
  { id: 'configuracoes', rotulo: 'Configurações', href: '/configuracoes', icone: 'configuracoes' },
];

/** Item ativo para o caminho atual (o prefixo mais longo vence). */
export function itemAtivo(caminho: string, itens: ItemNavegacao[] = NAVEGACAO): ItemNavegacao | undefined {
  return itens
    .filter((i) => caminho === i.href || caminho.startsWith(i.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Marca como bloqueadas as abas fora do plano. */
export function navegacaoDoPlano(abas: AbaContratavel[], itens: ItemNavegacao[] = NAVEGACAO) {
  return itens.map((i) => ({ ...i, bloqueada: i.aba ? !abas.includes(i.aba) : false }));
}
