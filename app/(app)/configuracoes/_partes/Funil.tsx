'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Botao, Cartao, CabecalhoCartao, CorpoCartao, useToast } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { ETAPAS_PADRAO, etapasDaEmpresa, idDeEtapa, validarEtapas } from '@/lib/contatos/funil';
import type { EtapaFunil } from '@/lib/tipos';

export function Funil({ podeEditar }: { podeEditar: boolean }) {
  const { empresa, api, recarregar } = useSessao();
  const { avisar } = useToast();
  const [etapas, setEtapas] = useState<EtapaFunil[]>(etapasDaEmpresa(empresa?.etapas));
  const [salvando, setSalvando] = useState(false);
  const erro = validarEtapas(etapas);

  function mover(i: number, d: -1 | 1) {
    const n = [...etapas];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    setEtapas(n);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api('/api/empresa', { metodo: 'PATCH', corpo: { etapas } });
      await recarregar();
      avisar('Funil salvo.');
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao>
      <CabecalhoCartao titulo="Etapas do funil" descricao="A ordem aqui é a ordem das colunas no quadro de Contatos. Contatos de etapa removida voltam para a primeira." />
      <CorpoCartao className="flex flex-col gap-2">
        {etapas.map((e, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="color" aria-label={`Cor de ${e.nome}`} value={e.cor ?? '#868C97'} disabled={!podeEditar} onChange={(x) => setEtapas(etapas.map((y, j) => (j === i ? { ...y, cor: x.target.value.toUpperCase() } : y)))} className="h-9 w-10 cursor-pointer rounded-lg border border-borda bg-superficie p-1" />
            <input
              aria-label="Nome da etapa"
              value={e.nome}
              disabled={!podeEditar}
              onChange={(x) => {
                const nome = x.target.value;
                // etapa nova ganha id pelo nome; etapas existentes mantêm o id (contatos apontam para ele)
                const existente = (empresa?.etapas ?? ETAPAS_PADRAO).some((y) => y.id === e.id);
                setEtapas(etapas.map((y, j) => (j === i ? { ...y, nome, id: existente ? y.id : idDeEtapa(nome) || `etapa-${i}` } : y)));
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border border-borda bg-superficie px-3 text-sm focus:border-acento-1 focus:outline-none"
            />
            {podeEditar && (
              <>
                <button aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)} className="rounded-lg p-1.5 text-texto-3 hover:text-texto disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button aria-label="Descer" disabled={i === etapas.length - 1} onClick={() => mover(i, 1)} className="rounded-lg p-1.5 text-texto-3 hover:text-texto disabled:opacity-30"><ArrowDown className="size-4" /></button>
                <button aria-label="Remover" onClick={() => setEtapas(etapas.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-texto-3 hover:text-erro"><Trash2 className="size-4" /></button>
              </>
            )}
          </div>
        ))}
        {erro && <p className="text-xs text-erro">{erro}</p>}
        {podeEditar && (
          <div className="mt-3 flex flex-wrap justify-between gap-2">
            <div className="flex gap-2">
              <Botao variante="secundario" tamanho="p" icone={<Plus className="size-3.5" />} onClick={() => setEtapas([...etapas, { id: `etapa-${Date.now().toString(36)}`, nome: 'Nova etapa', cor: '#3B5BDB' }])}>Etapa</Botao>
              <Botao variante="fantasma" tamanho="p" onClick={() => setEtapas(ETAPAS_PADRAO)}>Voltar ao padrão</Botao>
            </div>
            <Botao onClick={salvar} disabled={!!erro} carregando={salvando}>Salvar funil</Botao>
          </div>
        )}
      </CorpoCartao>
    </Cartao>
  );
}
