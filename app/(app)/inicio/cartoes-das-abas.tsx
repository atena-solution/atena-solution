'use client';

import type { ComponentType } from 'react';
import type { Papel } from '@/lib/tipos';
import { CartaoAtendimento } from '../atendimento/CartaoInicio';
import { CartaoCoachInicio } from '../coach/_componentes/contato';
import { CartaoEstudioInicio } from '../estudio/_componentes/CartaoInicio';

/**
 * Cartões das abas no Início. Cada um busca os próprios dados e usa <Cartao> do design system.
 * Só aparece se a aba estiver no plano da empresa (e, se `papeis`, para quem usa a aba).
 */
export const CARTOES_DAS_ABAS: { aba: 'atendimento' | 'coach' | 'estudio'; Componente: ComponentType; papeis?: Papel[] }[] = [
  { aba: 'atendimento', Componente: CartaoAtendimento },
  { aba: 'coach', Componente: CartaoCoachInicio, papeis: ['dono', 'gestor', 'vendedor'] },
  { aba: 'estudio', Componente: CartaoEstudioInicio },
];
