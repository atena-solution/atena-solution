'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeft, Check, Copy, ExternalLink, Plug, ShieldCheck, Unplug } from 'lucide-react'
import { Botao, Campo, Cartao, CabecalhoCartao, CorpoCartao, Esqueleto, Modal, Selo, cx, useToast } from '@/app/ui'
import { useDados, useSessao } from '@/lib/sessao'
import { tempoRelativo } from '@/lib/ui/formato'
import type { ModelosAprovados } from '@/lib/atendimento/tipos'

interface Estado {
  conectado: boolean
  urlWebhook: string
  tokenVerificacao: string | null
  simulado: boolean
  conexao?: {
    phoneNumberId: string
    wabaId: string
    token: string
    temAppSecret: boolean
    numeroExibicao?: string
    nomeVerificado?: string
    conectadoEm: string
    modelos: ModelosAprovados
  }
}

// Passo a passo do v1 manual (telas da Meta consultadas em 01/11/2026; nomes dos menus podem mudar). CONFIRMAR AO VIVO
const PASSOS = [
  {
    titulo: 'Crie o app na Meta',
    texto: 'Em developers.facebook.com, entre com o Facebook da empresa → Meus apps → Criar app (tipo Empresa) → adicione o produto WhatsApp.',
    link: 'https://developers.facebook.com/apps',
  },
  {
    titulo: 'Coloque o número da empresa',
    texto: 'Em WhatsApp → Configuração da API, adicione o número que vai atender (ele não pode estar em uso no app WhatsApp comum).',
  },
  {
    titulo: 'Copie os dois IDs',
    texto: 'Na mesma tela: "Identificação do número de telefone" e "Identificação da conta do WhatsApp Business". Cole abaixo.',
  },
  {
    titulo: 'Gere um token permanente',
    texto: 'Em business.facebook.com → Configurações → Usuários do sistema → crie um usuário administrador → Gerar token, com as permissões whatsapp_business_messaging e whatsapp_business_management.',
    link: 'https://business.facebook.com/settings/system-users',
  },
  {
    titulo: 'Ligue o webhook',
    texto: 'Em WhatsApp → Configuração → Webhook, cole a URL e o token de verificação abaixo e assine o campo "messages".',
  },
]

export function TelaConexao() {
  const { api, sessao } = useSessao()
  const { avisar } = useToast()
  const { dados, recarregar, erro } = useDados<Estado>('/api/whatsapp/conexao')
  const [form, setForm] = useState({ phoneNumberId: '', wabaId: '', token: '', appSecret: '' })
  const [modelos, setModelos] = useState<ModelosAprovados | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [desconectar, setDesconectar] = useState(false)
  const podeEditar = sessao?.papel === 'dono' || sessao?.papel === 'gestor'

  const m = modelos ?? dados?.conexao?.modelos ?? {}

  async function salvar() {
    setSalvando(true)
    try {
      const r = await api<{ numero: string; nome: string }>('/api/whatsapp/conexao', {
        corpo: {
          ...(form.phoneNumberId ? { phoneNumberId: form.phoneNumberId } : {}),
          ...(form.wabaId ? { wabaId: form.wabaId } : {}),
          ...(form.token ? { token: form.token } : {}),
          ...(form.appSecret ? { appSecret: form.appSecret } : {}),
          modelos: m,
        },
      })
      avisar(`Conectado: ${r.nome || r.numero}`, 'sucesso')
      setForm({ phoneNumberId: '', wabaId: '', token: '', appSecret: '' })
      setModelos(null)
      recarregar()
    } catch (e) {
      avisar((e as Error).message, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarDesconexao() {
    try {
      await api('/api/whatsapp/conexao', { metodo: 'DELETE' })
      avisar('WhatsApp desconectado. A IA parou de responder.', 'sucesso')
      setDesconectar(false)
      recarregar()
    } catch (e) {
      avisar((e as Error).message, 'erro')
    }
  }

  if (erro) return <p className="text-sm text-erro">{erro}</p>
  if (!dados) return <Esqueleto className="h-64 w-full" />
  const c = dados.conexao

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link href="/atendimento" className="mb-2 inline-flex items-center gap-1 text-[13px] text-texto-3 hover:text-texto">
          <ArrowLeft className="size-3.5" /> Atendimento
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-texto">WhatsApp da empresa</h1>
        <p className="mt-1 text-sm text-texto-2">Cada empresa conecta o próprio número oficial (API do WhatsApp da Meta).</p>
      </div>

      {dados.simulado && (
        <p className="rounded-xl border border-atencao/25 bg-atencao/10 px-4 py-3 text-[13px] text-atencao">
          Modo de teste: nada vai pra Meta. Qualquer ID e token funcionam, e as mensagens ficam só aqui dentro.
        </p>
      )}

      {c && (
        <Cartao className="border-atendimento/40">
          <CorpoCartao className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-atendimento/15 text-atendimento">
                <Plug className="size-5" />
              </span>
              <div>
                <p className="flex items-center gap-2 font-semibold text-texto">
                  {c.nomeVerificado || 'Número conectado'}
                  <Selo tom="sucesso" aoVivo>
                    Conectado
                  </Selo>
                </p>
                <p className="numero text-sm text-texto-2">{c.numeroExibicao || c.phoneNumberId}</p>
                <p className="text-xs text-texto-3">
                  Desde {tempoRelativo(c.conectadoEm)} · token {c.token}
                  {c.temAppSecret ? ' · app próprio' : ''}
                </p>
              </div>
            </div>
            {podeEditar && (
              <Botao variante="secundario" tamanho="p" icone={<Unplug className="size-4" />} onClick={() => setDesconectar(true)}>
                Desconectar
              </Botao>
            )}
          </CorpoCartao>
        </Cartao>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Cartao>
          <CabecalhoCartao titulo="Passo a passo" descricao="Leva uns 15 minutos. Faça uma vez só." />
          <CorpoCartao>
            <ol className="flex flex-col gap-4">
              {PASSOS.map((p, i) => (
                <li key={p.titulo} className="flex gap-3">
                  <span className="gradiente-atena numero flex size-6 shrink-0 items-center justify-center rounded-full text-xs text-white">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-texto">{p.titulo}</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-texto-2">{p.texto}</p>
                    {p.link && (
                      <a href={p.link} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-acento hover:underline">
                        Abrir <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-5 flex flex-col gap-3 rounded-xl bg-superficie-2 p-3">
              <Copiavel rotulo="URL do webhook" valor={dados.urlWebhook} />
              {dados.tokenVerificacao ? (
                <Copiavel rotulo="Token de verificação" valor={dados.tokenVerificacao} />
              ) : (
                <p className="text-xs text-texto-3">Token de verificação: peça para a equipe da Atena (configurado no servidor).</p>
              )}
            </div>
          </CorpoCartao>
        </Cartao>

        <Cartao>
          <CabecalhoCartao titulo={c ? 'Atualizar dados' : 'Conectar número'} descricao={c ? 'Deixe em branco o que não mudou.' : 'Cole os dados do passo 3 e 4.'} />
          <CorpoCartao>
            <fieldset disabled={!podeEditar} className="flex flex-col gap-4">
              <Campo
                rotulo="Identificação do número de telefone"
                placeholder={c?.phoneNumberId ?? 'Ex.: 109876543210987'}
                inputMode="numeric"
                value={form.phoneNumberId}
                onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              />
              <Campo
                rotulo="Identificação da conta do WhatsApp Business (WABA)"
                placeholder={c?.wabaId ?? 'Ex.: 102345678901234'}
                inputMode="numeric"
                value={form.wabaId}
                onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
              />
              <Campo
                rotulo="Token de acesso permanente"
                type="password"
                autoComplete="off"
                placeholder={c ? `Atual: ${c.token}` : 'EAAG…'}
                ajuda="Guardado cifrado. Ninguém da equipe consegue ver depois."
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
              />
              <Campo
                rotulo="Chave secreta do app (App Secret) — opcional"
                type="password"
                autoComplete="off"
                placeholder={c?.temAppSecret ? 'Já cadastrada' : 'Só se a empresa usa app próprio'}
                ajuda="Em Configurações do app → Básico. Usada para conferir que as mensagens vêm mesmo da Meta."
                value={form.appSecret}
                onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
              />

              <div className="border-t border-borda pt-4">
                <p className="text-sm font-medium text-texto">Modelos aprovados (fora da janela de 24h)</p>
                <p className="mt-0.5 text-[13px] text-texto-2">
                  Depois de 24h sem o cliente escrever, a Meta só deixa mandar modelos aprovados. Escreva o nome exato de cada um (Gerenciador do WhatsApp → Modelos de mensagem).
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Lembrete de horário" placeholder="lembrete_horario" ajuda="{{1}} nome, {{2}} serviço, {{3}} dia e hora" value={m.lembrete ?? ''} onChange={(e) => setModelos({ ...m, lembrete: e.target.value })} />
                  <Campo rotulo="Recuperar falta" placeholder="sentimos_sua_falta" ajuda="{{1}} nome, {{2}} serviço" value={m.recuperacao ?? ''} onChange={(e) => setModelos({ ...m, recuperacao: e.target.value })} />
                  <Campo rotulo="Pedido de avaliação" placeholder="pedido_avaliacao" ajuda="{{1}} nome, {{2}} link" value={m.avaliacao ?? ''} onChange={(e) => setModelos({ ...m, avaliacao: e.target.value })} />
                  <Campo rotulo="Retomar conversa (equipe)" placeholder="retomar_conversa" ajuda="{{1}} = texto da equipe" value={m.retomada ?? ''} onChange={(e) => setModelos({ ...m, retomada: e.target.value })} />
                </div>
              </div>
              {podeEditar ? (
                <Botao onClick={salvar} carregando={salvando} icone={<ShieldCheck className="size-4" />} disabled={!c && (!form.phoneNumberId || !form.wabaId || !form.token)}>
                  {c ? 'Salvar alterações' : 'Testar e conectar'}
                </Botao>
              ) : (
                <p className="text-[13px] text-texto-3">Só o dono ou gestor muda a conexão.</p>
              )}
            </fieldset>
          </CorpoCartao>
        </Cartao>
      </div>

      <Modal
        aberto={desconectar}
        aoFechar={() => setDesconectar(false)}
        titulo="Desconectar o WhatsApp?"
        descricao="A IA para de responder e as mensagens novas deixam de chegar aqui. As conversas antigas continuam salvas."
        largura="p"
        rodape={
          <>
            <Botao variante="fantasma" onClick={() => setDesconectar(false)}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmarDesconexao}>
              Desconectar
            </Botao>
          </>
        }
      >
        <span />
      </Modal>
    </div>
  )
}

function Copiavel({ rotulo, valor }: { rotulo: string; valor: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <div className="min-w-0">
      <p className="text-xs text-texto-3">{rotulo}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="numero min-w-0 flex-1 truncate rounded-lg border border-borda bg-superficie px-2.5 py-1.5 text-xs text-texto">{valor}</code>
        <button
          onClick={() => navigator.clipboard?.writeText(valor).then(() => (setCopiado(true), setTimeout(() => setCopiado(false), 1500)))}
          className={cx('rounded-lg p-1.5 text-texto-2 hover:bg-superficie', copiado && 'text-sucesso')}
          aria-label={`Copiar ${rotulo}`}
        >
          {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  )
}
