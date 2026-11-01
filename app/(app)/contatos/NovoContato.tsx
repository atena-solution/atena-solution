'use client';

import { useState } from 'react';
import { Botao, Campo, Modal, Select, useToast } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { ORIGENS_COMUNS, etapasDaEmpresa } from '@/lib/contatos/funil';
import type { Contato } from '@/lib/tipos';

export function NovoContato({ aberto, aoFechar, aoCriar }: { aberto: boolean; aoFechar: () => void; aoCriar: (c: Contato) => void }) {
  const { api, empresa } = useSessao();
  const { avisar } = useToast();
  const [f, setF] = useState({ nome: '', telefone: '', email: '', origem: 'WhatsApp', etapa: '', etiquetas: '' });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const etapas = etapasDaEmpresa(empresa?.etapas);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErros({});
    try {
      const r = await api<{ contato: Contato }>('/api/contatos', {
        corpo: { ...f, etapa: f.etapa || etapas[0].id, etiquetas: f.etiquetas.split(',').map((x) => x.trim()).filter(Boolean) },
      });
      avisar('Contato criado.');
      setF({ nome: '', telefone: '', email: '', origem: 'WhatsApp', etapa: '', etiquetas: '' });
      aoCriar(r.contato);
    } catch (x) {
      const err = x as Error & { erros?: Record<string, string> };
      if (err.erros) setErros(err.erros);
      else avisar(err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo="Novo contato"
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" form="form-novo-contato" carregando={salvando}>Salvar contato</Botao>
        </>
      }
    >
      <form id="form-novo-contato" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Campo rotulo="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} erro={erros.nome} required />
        </div>
        <Campo rotulo="WhatsApp" inputMode="tel" placeholder="(11) 99999-8888" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} erro={erros.telefone} required />
        <Campo rotulo="E-mail (opcional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} erro={erros.email} />
        <Select rotulo="Origem" value={f.origem} onChange={(e) => setF({ ...f, origem: e.target.value })} opcoes={ORIGENS_COMUNS.map((o) => ({ valor: o, rotulo: o }))} />
        <Select rotulo="Etapa" value={f.etapa || etapas[0].id} onChange={(e) => setF({ ...f, etapa: e.target.value })} opcoes={etapas.map((e) => ({ valor: e.id, rotulo: e.nome }))} />
        <div className="sm:col-span-2">
          <Campo rotulo="Etiquetas" ajuda="Separe por vírgula. Ex.: VIP, Pacote" value={f.etiquetas} onChange={(e) => setF({ ...f, etiquetas: e.target.value })} />
        </div>
      </form>
    </Modal>
  );
}
