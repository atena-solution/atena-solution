'use client';
// Faixa de aviso do plano (teste acabando, pagamento pendente, só leitura).
// Para a Base encaixar no topo da Moldura: <AvisoPlano />
import Link from 'next/link';
import { AlertTriangle, Info, Lock } from 'lucide-react';
import { useDados } from '@/lib/sessao';
import type { SituacaoAcesso } from '@/lib/planos/acesso';
import { cx } from '@/app/ui';

export function AvisoPlano() {
  const { dados } = useDados<{ situacao: SituacaoAcesso }>('/api/cobranca');
  const aviso = dados?.situacao.aviso;
  if (!aviso || (dados.situacao.fase === 'ativa' && aviso.tom === 'info')) return null;
  const Ico = aviso.tom === 'erro' ? Lock : aviso.tom === 'atencao' ? AlertTriangle : Info;
  return (
    <div role="status" className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] md:px-6',
      aviso.tom === 'erro' ? 'bg-erro/10 text-erro' : aviso.tom === 'atencao' ? 'bg-atencao/10 text-atencao' : 'bg-acento-1/8 text-acento')}>
      <Ico className="size-4 shrink-0" />
      <span className="text-texto">{aviso.texto}</span>
      <Link href="/plano" className="font-medium underline underline-offset-4">{dados.situacao.fase === 'teste' ? 'Escolher plano' : 'Ver plano'}</Link>
    </div>
  );
}
