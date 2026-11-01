import { redirect } from 'next/navigation';
import { obterPlano } from '@/lib/planos/preco';

/** "Testar grátis": cria a conta no login da Base e volta para o onboarding guiado, guardando o plano escolhido. */
export default async function Cadastro({ searchParams }: { searchParams: Promise<{ plano?: string }> }) {
  const { plano } = await searchParams;
  const p = plano && obterPlano(plano) ? `?plano=${plano}` : '';
  redirect(`/entrar?criar=1&voltar=${encodeURIComponent(`/comecar${p}`)}`);
}
