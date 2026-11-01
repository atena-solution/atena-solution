'use client';

import { Cabecalho } from '@/app/ui';
import { useSessao } from '@/lib/sessao';

export function PainelInicio() {
  const { empresa } = useSessao();
  return <Cabecalho titulo={empresa?.nome ?? 'Início'} descricao="Resumo do dia." />;
}
