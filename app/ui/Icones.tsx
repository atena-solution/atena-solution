import {
  Home,
  MessageCircle,
  Users,
  CalendarDays,
  Mic,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { ItemNavegacao } from '@/lib/navegacao';

/** Ícone de cada item da navegação (lucide). */
export const ICONES_NAV: Record<ItemNavegacao['icone'], LucideIcon> = {
  inicio: Home,
  atendimento: MessageCircle,
  contatos: Users,
  agenda: CalendarDays,
  coach: Mic,
  estudio: Sparkles,
  configuracoes: Settings,
};
