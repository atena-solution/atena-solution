'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Abas, Cabecalho } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { DadosEmpresa } from './_partes/DadosEmpresa';
import { Servicos } from './_partes/Servicos';
import { Profissionais } from './_partes/Profissionais';
import { Funil } from './_partes/Funil';
import { Equipe } from './_partes/Equipe';
import { Integracoes, Plano } from './_partes/PlanoEIntegracoes';

const ABAS = [
  { id: 'empresa', rotulo: 'Empresa' },
  { id: 'servicos', rotulo: 'Serviços' },
  { id: 'profissionais', rotulo: 'Profissionais' },
  { id: 'funil', rotulo: 'Funil' },
  { id: 'equipe', rotulo: 'Equipe' },
  { id: 'plano', rotulo: 'Plano e créditos' },
  { id: 'integracoes', rotulo: 'Integrações' },
];

export function TelaConfiguracoes() {
  const router = useRouter();
  const params = useSearchParams();
  const { empresa, sessao } = useSessao();
  const aba = ABAS.some((a) => a.id === params.get('aba')) ? params.get('aba')! : 'empresa';
  const podeEditar = sessao?.papel === 'dono' || sessao?.papel === 'gestor';

  return (
    <>
      <Cabecalho titulo="Configurações" descricao={podeEditar ? 'Dados da empresa, agenda, funil e equipe.' : 'Só dono ou gestor pode alterar estas configurações.'} />
      <Abas abas={ABAS} ativa={aba} aoMudar={(id) => router.replace(`/configuracoes?aba=${id}`, { scroll: false })} className="mb-6" />
      <div className="max-w-4xl">
        {aba === 'empresa' && empresa && <DadosEmpresa key={empresa.id} empresa={empresa} podeEditar={podeEditar} />}
        {aba === 'servicos' && <Servicos podeEditar={podeEditar} />}
        {aba === 'profissionais' && <Profissionais podeEditar={podeEditar} />}
        {aba === 'funil' && <Funil key={empresa?.id} podeEditar={podeEditar} />}
        {aba === 'equipe' && <Equipe />}
        {aba === 'plano' && <Plano />}
        {aba === 'integracoes' && <Integracoes />}
      </div>
    </>
  );
}
