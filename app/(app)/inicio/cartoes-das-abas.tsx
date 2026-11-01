'use client';

import type { ComponentType } from 'react';
import { CartaoAtendimento } from '../atendimento/CartaoInicio';

/**
 * Ponto de encaixe do Início: cada aba (Atendimento, Coach, Estúdio) adiciona aqui o SEU cartão.
 * O componente busca os próprios dados (ex.: /api/coach/resumo) e usa <Cartao> do design system.
 *
 *   import { CartaoCoach } from '../coach/CartaoInicio';
 *   export const CARTOES_DAS_ABAS = [{ aba: 'coach', Componente: CartaoCoach }];
 *
 * O cartão só aparece se a aba estiver no plano da empresa.
 */
export const CARTOES_DAS_ABAS: { aba: 'atendimento' | 'coach' | 'estudio'; Componente: ComponentType }[] = [
  { aba: 'atendimento', Componente: CartaoAtendimento },
];
