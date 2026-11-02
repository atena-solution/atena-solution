'use client';
// O Coach é de quem vende (dono, gestor, vendedor). Para a atendente, uma explicação em vez de erro.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Mic } from 'lucide-react';
import { Cartao, Vazio } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { PAPEIS_COACH_CLIENTE } from './rotulos';

export function GuardaCoach({ children }: { children: ReactNode }) {
  const { sessao } = useSessao();
  if (sessao && !PAPEIS_COACH_CLIENTE.includes(sessao.papel)) {
    return (
      <Cartao className="mx-auto mt-6 max-w-xl">
        <Vazio
          icone={<Mic />}
          titulo="O Coach é da equipe de vendas"
          descricao="Quem usa é o dono, o gestor e os vendedores. Se você também vende, peça ao dono para mudar o seu papel em Configurações → Equipe."
          acao={<Link href="/inicio" className="text-sm font-medium text-acento hover:underline">Voltar ao Início</Link>}
        />
      </Cartao>
    );
  }
  return <>{children}</>;
}
