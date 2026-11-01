'use client';

import { useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Avatar, Botao, Campo, Cartao, CabecalhoCartao, CorpoCartao, Esqueleto, Modal, Select, Selo, useToast } from '@/app/ui';
import { useDados, useSessao } from '@/lib/sessao';
import { NOME_PAPEL } from '@/lib/auth/permissoes';
import { PAPEIS, type Convite, type Membro, type Papel } from '@/lib/tipos';

const DESCRICAO_PAPEL: Record<Papel, string> = {
  dono: 'Tudo, inclusive plano e equipe.',
  gestor: 'Tudo da operação e da equipe.',
  atendente: 'Atendimento, contatos e agenda.',
  vendedor: 'Coach, contatos e agenda.',
};

export function Equipe() {
  const { api, sessao } = useSessao();
  const { avisar } = useToast();
  const { dados, recarregar } = useDados<{ membros: Membro[]; convites: Convite[] }>('/api/equipe');
  const [convidar, setConvidar] = useState(false);
  const [email, setEmail] = useState('');
  const [papel, setPapel] = useState<Papel>('atendente');
  const [enviando, setEnviando] = useState(false);
  const gestor = sessao?.papel === 'dono' || sessao?.papel === 'gestor';
  const papeisPermitidos = sessao?.papel === 'dono' ? PAPEIS : PAPEIS.filter((p) => p !== 'dono');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await api('/api/equipe', { corpo: { email, papel } });
      avisar(`Convite criado. Peça para ${email} entrar com esse e-mail.`);
      setConvidar(false);
      setEmail('');
      recarregar();
    } catch (x) {
      avisar((x as Error).message, 'erro');
    } finally {
      setEnviando(false);
    }
  }

  async function mudar(m: Membro, corpo: Partial<Membro>) {
    try {
      await api(`/api/equipe/${m.uid}`, { metodo: 'PATCH', corpo });
      recarregar();
    } catch (x) {
      avisar((x as Error).message, 'erro');
    }
  }

  if (!dados) return <Esqueleto className="h-48 w-full" />;
  return (
    <div className="flex flex-col gap-5">
      <Cartao>
        <CabecalhoCartao
          titulo="Equipe"
          descricao={`${dados.membros.filter((m) => m.ativo).length} pessoas ativas`}
          acao={gestor && <Botao icone={<UserPlus className="size-4" />} onClick={() => setConvidar(true)}>Convidar</Botao>}
        />
        <CorpoCartao className="flex flex-col divide-y divide-borda p-0 pt-3">
          {dados.membros.map((m) => (
            <div key={m.uid} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar nome={m.nome} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.nome} {m.uid === sessao?.uid && <span className="text-texto-3">(você)</span>}
                  </p>
                  <p className="truncate text-xs text-texto-3">{m.email}</p>
                </div>
                {!m.ativo && <Selo>Desativado</Selo>}
              </div>
              {gestor && m.uid !== sessao?.uid ? (
                <div className="flex items-center gap-2">
                  <div className="w-36">
                    <Select aria-label={`Papel de ${m.nome}`} value={m.papel} onChange={(e) => mudar(m, { papel: e.target.value as Papel })} opcoes={(m.papel === 'dono' ? PAPEIS : papeisPermitidos).map((p) => ({ valor: p, rotulo: NOME_PAPEL[p] }))} />
                  </div>
                  <Botao variante="fantasma" tamanho="p" onClick={() => mudar(m, { ativo: !m.ativo })}>{m.ativo ? 'Desativar' : 'Reativar'}</Botao>
                </div>
              ) : (
                <Selo tom={m.papel === 'dono' ? 'acento' : 'neutro'}>{NOME_PAPEL[m.papel]}</Selo>
              )}
            </div>
          ))}
        </CorpoCartao>
      </Cartao>

      {dados.convites.length > 0 && (
        <Cartao>
          <CabecalhoCartao titulo="Convites pendentes" descricao="Entram na equipe quando fizerem login com esse e-mail." />
          <CorpoCartao className="flex flex-col gap-2">
            {dados.convites.map((c) => (
              <div key={c.email} className="flex items-center gap-3 rounded-xl border border-borda px-3.5 py-2.5">
                <span className="flex-1 truncate text-sm">{c.email}</span>
                <Selo>{NOME_PAPEL[c.papel]}</Selo>
                <button
                  aria-label={`Cancelar convite de ${c.email}`}
                  onClick={async () => {
                    await api(`/api/equipe/convites/${encodeURIComponent(c.email)}`, { metodo: 'DELETE' });
                    recarregar();
                  }}
                  className="rounded-lg p-1 text-texto-3 hover:text-erro"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </CorpoCartao>
        </Cartao>
      )}

      <Modal
        aberto={convidar}
        aoFechar={() => setConvidar(false)}
        titulo="Convidar para a equipe"
        rodape={<><Botao variante="fantasma" onClick={() => setConvidar(false)}>Cancelar</Botao><Botao type="submit" form="form-convite" carregando={enviando}>Convidar</Botao></>}
      >
        <form id="form-convite" onSubmit={enviar} className="flex flex-col gap-4">
          <Campo rotulo="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] font-medium text-texto-2">Papel</legend>
            {papeisPermitidos.map((p) => (
              <label key={p} className="flex cursor-pointer items-start gap-3 rounded-xl border border-borda p-3 has-[:checked]:border-acento-1 has-[:checked]:bg-acento-1/5">
                <input type="radio" name="papel" value={p} checked={papel === p} onChange={() => setPapel(p)} className="mt-0.5 accent-[var(--acento-1)]" />
                <span>
                  <span className="block text-sm font-medium">{NOME_PAPEL[p]}</span>
                  <span className="block text-xs text-texto-3">{DESCRICAO_PAPEL[p]}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="text-xs text-texto-3">O envio automático do e-mail de convite chega numa próxima versão. Por enquanto, avise a pessoa para entrar com esse e-mail.</p>
        </form>
      </Modal>
    </div>
  );
}
