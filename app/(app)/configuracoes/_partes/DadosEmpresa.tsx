'use client';

import { useState } from 'react';
import { Botao, Campo, Cartao, CabecalhoCartao, CorpoCartao, Select, useToast } from '@/app/ui';
import { useSessao } from '@/lib/sessao';
import { formatarTelefone } from '@/lib/ui/formato';
import type { Empresa } from '@/lib/tipos';
import { EditorHorarios } from './EditorHorarios';
import { SEGMENTOS, TONS } from './SEGMENTOS';

/** Dados da empresa, horário e marca. Usado em Configurações e no onboarding. */
export function DadosEmpresa({ empresa, podeEditar }: { empresa: Empresa; podeEditar: boolean }) {
  const { api, recarregar } = useSessao();
  const { avisar } = useToast();
  const [f, setF] = useState({
    nome: empresa.nome,
    segmento: empresa.segmento,
    telefone: formatarTelefone(empresa.telefone),
    endereco: empresa.endereco,
    horarios: empresa.horarios,
    marca: empresa.marca,
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErros({});
    try {
      await api('/api/empresa', { metodo: 'PATCH', corpo: f });
      await recarregar();
      avisar('Dados salvos.');
    } catch (x) {
      const err = x as Error & { erros?: Record<string, string> };
      if (err.erros) setErros(err.erros);
      avisar(err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5">
      <fieldset disabled={!podeEditar} className="contents">
        <Cartao>
          <CabecalhoCartao titulo="Empresa" descricao="A IA usa estes dados para se apresentar e responder." />
          <CorpoCartao className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Nome da empresa" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} erro={erros.nome} />
            <Select rotulo="Segmento" value={f.segmento} onChange={(e) => setF({ ...f, segmento: e.target.value })} opcoes={[...new Set([f.segmento, ...SEGMENTOS])].filter(Boolean).map((s) => ({ valor: s, rotulo: s }))} />
            <Campo rotulo="Telefone / WhatsApp" inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} erro={erros.telefone} />
            <Campo rotulo="Endereço" value={f.endereco} onChange={(e) => setF({ ...f, endereco: e.target.value })} />
          </CorpoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Horário de funcionamento" descricao="A agenda só oferece horários dentro disto." />
          <CorpoCartao>
            <EditorHorarios valor={f.horarios} aoMudar={(h) => setF({ ...f, horarios: h })} />
            {Object.entries(erros).filter(([k]) => k.startsWith('horarios')).map(([k, v]) => <p key={k} className="mt-2 text-xs text-erro">{v}</p>)}
          </CorpoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo="Marca" descricao="Logo, cores e tom de voz — usados pelo Estúdio e pela IA." />
          <CorpoCartao className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Campo
                rotulo="Link da logo"
                placeholder="https://…"
                ajuda="Por enquanto, cole o link da imagem. O envio de arquivo chega com o Estúdio."
                value={f.marca.logoUrl}
                onChange={(e) => setF({ ...f, marca: { ...f.marca, logoUrl: e.target.value } })}
                erro={erros.logo}
              />
            </div>
            {(['primaria', 'secundaria'] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-texto-2" htmlFor={`cor-${k}`}>Cor {k === 'primaria' ? 'principal' : 'secundária'}</label>
                <div className="flex items-center gap-2">
                  <input
                    id={`cor-${k}`}
                    type="color"
                    value={f.marca.cores[k]}
                    onChange={(e) => setF({ ...f, marca: { ...f.marca, cores: { ...f.marca.cores, [k]: e.target.value.toUpperCase() } } })}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-borda bg-superficie p-1"
                  />
                  <span className="numero text-sm text-texto-2">{f.marca.cores[k]}</span>
                </div>
              </div>
            ))}
            <div className="sm:col-span-2">
              <Select rotulo="Tom de voz" value={f.marca.tom} vazio="Escolha" onChange={(e) => setF({ ...f, marca: { ...f.marca, tom: e.target.value } })} opcoes={[...new Set([f.marca.tom, ...TONS])].filter(Boolean).map((t) => ({ valor: t, rotulo: t }))} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-borda" style={{ background: `linear-gradient(135deg, ${f.marca.cores.primaria}, ${f.marca.cores.secundaria})` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.marca.logoUrl && <img src={f.marca.logoUrl} alt="" className="size-full object-contain" />}
              </span>
              <span className="text-sm text-texto-2">Prévia</span>
            </div>
          </CorpoCartao>
        </Cartao>
      </fieldset>
      {podeEditar && (
        <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
          <Botao type="submit" carregando={salvando} className="shadow-lg">Salvar alterações</Botao>
        </div>
      )}
    </form>
  );
}
