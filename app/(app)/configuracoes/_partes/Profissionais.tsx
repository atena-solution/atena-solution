'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, UserRound } from 'lucide-react';
import { Avatar, Botao, Campo, Cartao, Esqueleto, Modal, Vazio, cx, useToast } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import { nomeDia } from '@/lib/agenda/fuso';
import type { Profissional, Servico } from '@/lib/tipos';
import { EditorHorarios } from './EditorHorarios';

export function Profissionais({ podeEditar }: { podeEditar: boolean }) {
  const { api } = useSessao();
  const { avisar } = useToast();
  const { dados, recarregar } = useDados<{ profissionais: Profissional[] }>('/api/profissionais');
  const { dados: sv } = useDados<{ servicos: Servico[] }>('/api/servicos');
  const [editando, setEditando] = useState<Partial<Profissional> | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      if (editando.id) await api(`/api/profissionais/${editando.id}`, { metodo: 'PATCH', corpo: editando });
      else await api('/api/profissionais', { corpo: editando });
      avisar('Salvo.');
      setEditando(null);
      recarregar();
    } catch (x) {
      avisar((x as Error).message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function apagar(p: Profissional) {
    if (!confirm(`Tirar ${p.nome} da agenda?`)) return;
    await api(`/api/profissionais/${p.id}`, { metodo: 'DELETE' });
    recarregar();
  }

  if (!dados) return <Esqueleto className="h-48 w-full" />;
  const servicos = sv?.servicos ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-texto-2">Quem atende (ou salas/equipamentos). Cada um tem a sua agenda.</p>
        {podeEditar && <Botao icone={<Plus className="size-4" />} onClick={() => setEditando({ nome: '', servicosIds: [], horarios: [] })}>Adicionar</Botao>}
      </div>
      {dados.profissionais.length === 0 ? (
        <Cartao><Vazio icone={<UserRound />} titulo="Ninguém na agenda ainda" descricao="Adicione quem atende para liberar a marcação de horários." /></Cartao>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {dados.profissionais.map((p) => (
            <Cartao key={p.id} className="flex items-start gap-3 p-4">
              <Avatar nome={p.nome} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{p.nome}</p>
                <p className="truncate text-xs text-texto-3">
                  {p.servicosIds.length === 0 ? 'Todos os serviços' : p.servicosIds.map((id) => servicos.find((s) => s.id === id)?.nome).filter(Boolean).join(', ')}
                </p>
                <p className="mt-1 text-xs text-texto-3">
                  {p.horarios.length === 0 ? 'Horário da empresa' : [...new Set(p.horarios.map((h) => h.dia))].map((d) => nomeDia(d, true)).join(' · ')}
                </p>
              </div>
              {podeEditar && (
                <span className="flex gap-1">
                  <button aria-label={`Editar ${p.nome}`} onClick={() => setEditando(p)} className="rounded-lg p-1.5 text-texto-3 hover:bg-superficie-2 hover:text-texto"><Pencil className="size-4" /></button>
                  <button aria-label={`Apagar ${p.nome}`} onClick={() => apagar(p)} className="rounded-lg p-1.5 text-texto-3 hover:bg-superficie-2 hover:text-erro"><Trash2 className="size-4" /></button>
                </span>
              )}
            </Cartao>
          ))}
        </div>
      )}
      <Modal
        aberto={!!editando}
        aoFechar={() => setEditando(null)}
        titulo={editando?.id ? 'Editar' : 'Adicionar à agenda'}
        largura="g"
        rodape={<><Botao variante="fantasma" onClick={() => setEditando(null)}>Cancelar</Botao><Botao type="submit" form="form-prof" carregando={salvando}>Salvar</Botao></>}
      >
        {editando && (
          <form id="form-prof" onSubmit={salvar} className="flex flex-col gap-5">
            <Campo rotulo="Nome" value={editando.nome ?? ''} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} required />
            <fieldset>
              <legend className="mb-2 text-[13px] font-medium text-texto-2">Serviços que faz <span className="font-normal text-texto-3">(nenhum marcado = todos)</span></legend>
              <div className="flex flex-wrap gap-2">
                {servicos.map((s) => {
                  const sel = editando.servicosIds?.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      aria-pressed={sel}
                      onClick={() => setEditando({ ...editando, servicosIds: sel ? editando.servicosIds!.filter((x) => x !== s.id) : [...(editando.servicosIds ?? []), s.id] })}
                      className={cx('h-8 rounded-full border px-3 text-sm', sel ? 'border-acento-1 bg-acento-1/10 text-acento' : 'border-borda text-texto-2 hover:border-borda-forte')}
                    >
                      {s.nome}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div>
              <p className="mb-2 text-[13px] font-medium text-texto-2">Horário de trabalho</p>
              <EditorHorarios valor={editando.horarios ?? []} aoMudar={(h) => setEditando({ ...editando, horarios: h })} permitirVazio="Sem horário próprio: segue o horário da empresa." />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
