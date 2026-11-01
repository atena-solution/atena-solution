'use client';

import { useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Botao, Modal, Selo, useToast } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { formatarTelefone } from '@/lib/ui/formato';
import type { Contato } from '@/lib/tipos';

interface Previa {
  novos: number;
  duplicados: number;
  erros: { linha: number; motivo: string }[];
  amostra: Contato[];
}

export function ImportarCsv({ aberto, aoFechar, aoImportar }: { aberto: boolean; aoFechar: () => void; aoImportar: () => void }) {
  const { api } = useSessao();
  const { avisar } = useToast();
  const [csv, setCsv] = useState('');
  const [arquivo, setArquivo] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function fechar() {
    setCsv('');
    setArquivo('');
    setPrevia(null);
    aoFechar();
  }

  async function escolher(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) return avisar('Arquivo grande demais (máx. 2 MB).', 'erro');
    const texto = await f.text();
    setArquivo(f.name);
    setCsv(texto);
    setOcupado(true);
    try {
      setPrevia(await api<Previa>('/api/contatos/importar', { corpo: { csv: texto, simular: true } }));
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    setOcupado(true);
    try {
      const r = await api<{ importados: number }>('/api/contatos/importar', { corpo: { csv } });
      avisar(`${r.importados} contatos importados.`);
      aoImportar();
      fechar();
    } catch (e) {
      avisar((e as Error).message, 'erro');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Importar contatos"
      descricao="Planilha em CSV com pelo menos a coluna de telefone (ou WhatsApp)."
      rodape={
        <>
          <Botao variante="fantasma" onClick={fechar}>Cancelar</Botao>
          <Botao onClick={confirmar} disabled={!previa || previa.novos === 0} carregando={ocupado && !!previa}>
            {previa ? `Importar ${previa.novos} contatos` : 'Importar'}
          </Botao>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-cartao border border-dashed border-borda-forte bg-superficie-2/50 px-6 py-8 text-center transition-colors hover:border-acento-1">
        {arquivo ? <FileText className="size-6 text-acento" aria-hidden /> : <Upload className="size-6 text-texto-3" aria-hidden />}
        <span className="text-sm font-medium">{arquivo || 'Escolher arquivo .csv'}</span>
        <span className="text-xs text-texto-3">Colunas reconhecidas: nome, telefone/whatsapp, email, etiquetas, origem. As outras viram campos extras.</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => escolher(e.target.files?.[0])} />
      </label>

      {previa && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Selo tom="sucesso">{previa.novos} novos</Selo>
            {previa.duplicados > 0 && <Selo>{previa.duplicados} já existiam</Selo>}
            {previa.erros.length > 0 && <Selo tom="erro">{previa.erros.length} com erro</Selo>}
          </div>
          {previa.amostra.length > 0 && (
            <ul className="divide-y divide-borda rounded-xl border border-borda text-sm">
              {previa.amostra.map((c) => (
                <li key={c.id} className="flex justify-between px-3 py-2">
                  <span>{c.nome}</span>
                  <span className="numero text-texto-3">{formatarTelefone(c.telefone)}</span>
                </li>
              ))}
            </ul>
          )}
          {previa.erros.length > 0 && (
            <ul className="max-h-32 overflow-y-auto text-xs text-erro">
              {previa.erros.slice(0, 20).map((e) => (
                <li key={e.linha}>Linha {e.linha}: {e.motivo}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
