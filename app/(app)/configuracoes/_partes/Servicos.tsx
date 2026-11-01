'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Scissors } from 'lucide-react';
import { AreaTexto, Botao, Campo, Cartao, Esqueleto, Modal, Tabela, Vazio, useToast } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import { formatarReais } from '@/lib/ui/formato';
import type { Servico } from '@/lib/tipos';

export function Servicos({ podeEditar }: { podeEditar: boolean }) {
  const { api } = useSessao();
  const { avisar } = useToast();
  const { dados, recarregar } = useDados<{ servicos: Servico[] }>('/api/servicos');
  const [editando, setEditando] = useState<Partial<Servico> | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    setErros({});
    try {
      const corpo = { ...editando, duracaoMin: Number(editando.duracaoMin), preco: Number(String(editando.preco ?? 0).replace(',', '.')) };
      if (editando.id) await api(`/api/servicos/${editando.id}`, { metodo: 'PATCH', corpo });
      else await api('/api/servicos', { corpo });
      avisar('Serviço salvo.');
      setEditando(null);
      recarregar();
    } catch (x) {
      const err = x as Error & { erros?: Record<string, string> };
      if (err.erros) setErros(err.erros);
      else avisar(err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(s: Servico) {
    if (!confirm(`Apagar "${s.nome}"?`)) return;
    await api(`/api/servicos/${s.id}`, { metodo: 'DELETE' });
    recarregar();
  }

  if (!dados) return <Esqueleto className="h-48 w-full" />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-texto-2">A IA do Atendimento só oferece o que está aqui, com esse preço e essa duração.</p>
        {podeEditar && <Botao icone={<Plus className="size-4" />} onClick={() => (setErros({}), setEditando({ nome: '', duracaoMin: 30, preco: 0, descricao: '' }))}>Novo serviço</Botao>}
      </div>
      <Tabela
        linhas={dados.servicos}
        chaveLinha={(s) => s.id}
        vazio={<Cartao><Vazio icone={<Scissors />} titulo="Nenhum serviço ainda" descricao="Cadastre o que você vende, com duração e preço." /></Cartao>}
        colunas={[
          { chave: 'nome', titulo: 'Serviço', render: (s) => <span><span className="font-medium">{s.nome}</span>{s.descricao && <span className="block truncate text-xs text-texto-3">{s.descricao}</span>}</span> },
          { chave: 'dur', titulo: 'Duração', render: (s) => <span className="numero">{s.duracaoMin} min</span> },
          { chave: 'preco', titulo: 'Preço', render: (s) => <span className="numero">{formatarReais(s.preco)}</span> },
          {
            chave: 'acoes',
            titulo: '',
            className: 'w-24 text-right',
            render: (s) =>
              podeEditar && (
                <span className="flex justify-end gap-1">
                  <button aria-label={`Editar ${s.nome}`} onClick={() => (setErros({}), setEditando(s))} className="rounded-lg p-1.5 text-texto-3 hover:bg-superficie-2 hover:text-texto"><Pencil className="size-4" /></button>
                  <button aria-label={`Apagar ${s.nome}`} onClick={() => apagar(s)} className="rounded-lg p-1.5 text-texto-3 hover:bg-superficie-2 hover:text-erro"><Trash2 className="size-4" /></button>
                </span>
              ),
          },
        ]}
      />
      <Modal
        aberto={!!editando}
        aoFechar={() => setEditando(null)}
        titulo={editando?.id ? 'Editar serviço' : 'Novo serviço'}
        rodape={<><Botao variante="fantasma" onClick={() => setEditando(null)}>Cancelar</Botao><Botao type="submit" form="form-servico" carregando={salvando}>Salvar</Botao></>}
      >
        {editando && (
          <form id="form-servico" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Campo rotulo="Nome" value={editando.nome ?? ''} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} erro={erros.nome} required /></div>
            <Campo rotulo="Duração (minutos)" type="number" min={5} step={5} value={editando.duracaoMin ?? ''} onChange={(e) => setEditando({ ...editando, duracaoMin: e.target.value as unknown as number })} erro={erros.duracaoMin} />
            <Campo rotulo="Preço (R$)" inputMode="decimal" value={editando.preco ?? ''} onChange={(e) => setEditando({ ...editando, preco: e.target.value as unknown as number })} erro={erros.preco} />
            <div className="sm:col-span-2"><AreaTexto rotulo="Descrição" ajuda="A IA usa isto para explicar o serviço ao cliente." value={editando.descricao ?? ''} onChange={(e) => setEditando({ ...editando, descricao: e.target.value })} /></div>
          </form>
        )}
      </Modal>
    </div>
  );
}
