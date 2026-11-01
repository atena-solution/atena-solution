'use client'

// Dados da caixa de entrada em tempo real.
// - Com Firebase de verdade: onSnapshot do Firestore (regras em firestore.rules deixam o membro ler a própria empresa).
// - No modo simulado: consulta a API a cada poucos segundos.
// Doc Firestore web (consultada em 01/11/2026, firebase.google.com/docs/firestore/query-data/listen). CONFIRMAR AO VIVO

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSessao } from '@/lib/sessao'
import { loginSimulado } from '@/lib/auth/cliente'
import type { Agendamento, Atividade, Contato, Conversa, Mensagem } from '@/lib/atendimento/tipos'
import type { EstadoJanela } from '@/lib/atendimento/janela'

async function firestore() {
  if (loginSimulado()) return null
  const { getApps } = await import('firebase/app')
  const app = getApps()[0]
  if (!app) return null
  const fs = await import('firebase/firestore')
  return { db: fs.getFirestore(app), fs }
}

export function useAgora(ms = 15_000) {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return agora
}

export function useConversas() {
  const { sessao, api } = useSessao()
  const [conversas, setConversas] = useState<Conversa[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aoVivo, setAoVivo] = useState(false)
  const empresaId = sessao?.empresaId

  useEffect(() => {
    if (!empresaId) return
    let parar = () => {}
    let vivo = true
    ;(async () => {
      const f = await firestore().catch(() => null)
      if (f && vivo) {
        const q = f.fs.query(f.fs.collection(f.db, 'empresas', empresaId, 'conversas'), f.fs.orderBy('ultimaMensagem.em', 'desc'), f.fs.limit(300))
        parar = f.fs.onSnapshot(
          q,
          (s) => {
            setConversas(s.docs.map((d) => d.data() as Conversa).filter((c) => c.telefone))
            setAoVivo(true)
            setErro(null)
          },
          (e) => setErro(e.message),
        )
        return
      }
      const buscar = () =>
        api<{ conversas: Conversa[] }>('/api/whatsapp/conversas')
          .then((r) => vivo && (setConversas(r.conversas), setErro(null), setAoVivo(true)))
          .catch((e: Error) => vivo && setErro(e.message))
      await buscar()
      const t = setInterval(buscar, 3000)
      parar = () => clearInterval(t)
    })()
    return () => {
      vivo = false
      parar()
    }
  }, [empresaId, api])

  return { conversas, erro, aoVivo, carregando: conversas === null && !erro }
}

export interface DetalheConversa {
  conversa: Conversa
  mensagens: Mensagem[]
  contato: Contato | null
  agendamentos: Agendamento[]
  atividades: Atividade[]
  janela: EstadoJanela
  temModeloRetomada: boolean
  servicos: { id: string; nome: string }[]
  profissionais: { id: string; nome: string }[]
}

export function useConversa(id: string | null) {
  const { sessao, api } = useSessao()
  const [detalhe, setDetalhe] = useState<DetalheConversa | null>(null)
  const [mensagensVivas, setMensagensVivas] = useState<Mensagem[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const empresaId = sessao?.empresaId
  const idAtual = useRef(id)
  useEffect(() => {
    idAtual.current = id
  }, [id])

  const recarregar = useCallback(async () => {
    if (!id) return
    try {
      const d = await api<DetalheConversa>(`/api/whatsapp/conversas/${encodeURIComponent(id)}`)
      if (idAtual.current === id) {
        setDetalhe(d)
        setErro(null)
      }
    } catch (e) {
      if (idAtual.current === id) setErro((e as Error).message)
    }
  }, [id, api])

  useEffect(() => {
    setDetalhe(null)
    setMensagensVivas(null)
    setErro(null)
    if (!id || !empresaId) return
    let parar = () => {}
    let vivo = true
    ;(async () => {
      await recarregar()
      const f = await firestore().catch(() => null)
      if (f && vivo) {
        const q = f.fs.query(f.fs.collection(f.db, 'empresas', empresaId, 'conversas', id, 'mensagens'), f.fs.orderBy('em'), f.fs.limitToLast(200))
        const pararMsgs = f.fs.onSnapshot(q, (s) => setMensagensVivas(s.docs.map((d) => d.data() as Mensagem)))
        // a ficha (etapa, agendamentos) muda menos: recarrega quando a conversa muda
        const pararConv = f.fs.onSnapshot(f.fs.doc(f.db, 'empresas', empresaId, 'conversas', id), (s) => {
          const c = s.data() as Conversa | undefined
          if (c) setDetalhe((d) => (d ? { ...d, conversa: c } : d))
        })
        parar = () => (pararMsgs(), pararConv())
        return
      }
      const t = setInterval(recarregar, 2500)
      parar = () => clearInterval(t)
    })()
    return () => {
      vivo = false
      parar()
    }
  }, [id, empresaId, recarregar])

  const mensagens = mensagensVivas ?? detalhe?.mensagens ?? null
  return { detalhe, mensagens, erro, recarregar }
}
