'use client';

import { useState } from 'react';
import { Plus, Search, Users, CalendarDays, MessageCircle, Sparkles, Mic, Trash2 } from 'lucide-react';
import {
  Abas,
  AreaTexto,
  Avatar,
  Botao,
  CabecalhoCartao,
  Campo,
  Cartao,
  CorpoCartao,
  Esqueleto,
  EsqueletoLista,
  Folha,
  Logo,
  Modal,
  ProvedorToast,
  Select,
  Selo,
  Tabela,
  Vazio,
  useToast,
} from '.';
import { BotaoTema } from '@/app/(app)/Casca';

const linhas = [
  { id: '1', nome: 'Mariana Lopes', etapa: 'Agendado', origem: 'WhatsApp', valor: 'R$ 180,00' },
  { id: '2', nome: 'Fernanda Costa', etapa: 'Novo', origem: 'Instagram', valor: 'R$ 60,00' },
  { id: '3', nome: 'Juliana Rocha', etapa: 'Cliente', origem: 'Indicação', valor: 'R$ 220,00' },
];

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xs font-medium tracking-[0.2em] text-texto-3 uppercase">{titulo}</h2>
      {children}
    </section>
  );
}

function Conteudo() {
  const { avisar } = useToast();
  const [aba, setAba] = useState('abertas');
  const [modal, setModal] = useState(false);
  const [folha, setFolha] = useState(false);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-14 px-4 py-12 md:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <div className="w-44">
          <BotaoTema />
        </div>
      </header>
      <div>
        <h1 className="titulo-serif text-5xl">Design system</h1>
        <p className="mt-2 text-texto-2">Componentes da Atena. Importe de <code className="numero">@/app/ui</code>.</p>
      </div>

      <Secao titulo="Cores">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            ['Fundo', 'var(--fundo)'],
            ['Superfície', 'var(--superficie)'],
            ['Acento', 'linear-gradient(135deg,var(--acento-1),var(--acento-2))'],
            ['Sucesso', 'var(--sucesso)'],
            ['Atenção', 'var(--atencao)'],
            ['Erro', 'var(--erro)'],
            ['Atendimento', 'var(--aba-atendimento)'],
            ['Coach', 'var(--aba-coach)'],
            ['Estúdio', 'var(--aba-estudio)'],
          ].map(([n, c]) => (
            <div key={n} className="overflow-hidden rounded-cartao border border-borda">
              <div className="h-16" style={{ background: c }} />
              <p className="px-3 py-2 text-xs text-texto-2">{n}</p>
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Tipografia">
        <Cartao>
          <CorpoCartao className="flex flex-col gap-3">
            <p className="titulo-serif text-4xl">Atendimento que não dorme.</p>
            <p className="text-2xl font-semibold tracking-tight">Título de página — Inter 600</p>
            <p className="text-sm text-texto-2">Texto de apoio, frases curtas e verbos claros.</p>
            <p className="numero text-3xl">R$ 12.480 · 98%</p>
          </CorpoCartao>
        </Cartao>
      </Secao>

      <Secao titulo="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Botao icone={<Plus className="size-4" />}>Marcar horário</Botao>
          <Botao variante="secundario">Assumir conversa</Botao>
          <Botao variante="fantasma">Cancelar</Botao>
          <Botao variante="perigo" icone={<Trash2 className="size-4" />}>Excluir</Botao>
          <Botao carregando>Salvando</Botao>
          <Botao tamanho="p" variante="secundario">Pequeno</Botao>
          <Botao tamanho="g">Grande</Botao>
          <Botao disabled>Desativado</Botao>
        </div>
      </Secao>

      <Secao titulo="Campos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome do cliente" placeholder="Ex.: Mariana Lopes" />
          <Campo rotulo="Buscar" icone={<Search />} placeholder="Nome ou telefone" />
          <Campo rotulo="Telefone" defaultValue="11 9999" erro="Telefone inválido. Ex.: (11) 99999-8888" />
          <Select
            rotulo="Etapa"
            opcoes={[
              { valor: 'novo', rotulo: 'Novo' },
              { valor: 'agendado', rotulo: 'Agendado' },
            ]}
          />
          <div className="sm:col-span-2">
            <AreaTexto rotulo="Nota" ajuda="Só a equipe vê." placeholder="Escreva algo sobre o cliente…" />
          </div>
        </div>
      </Secao>

      <Secao titulo="Selos e avatares">
        <div className="flex flex-wrap items-center gap-2">
          <Selo>Neutro</Selo>
          <Selo tom="acento">Novo</Selo>
          <Selo tom="sucesso" ponto>Confirmado</Selo>
          <Selo tom="atencao">Esperando há 6 min</Selo>
          <Selo tom="erro">Faltou</Selo>
          <Selo tom="atendimento" aoVivo>Ao vivo</Selo>
          <Selo tom="coach">Coach</Selo>
          <Selo tom="estudio">Estúdio</Selo>
        </div>
        <div className="flex items-center gap-3">
          <Avatar nome="Mariana Lopes" tamanho="p" />
          <Avatar nome="Caio Duarte" />
          <Avatar nome="Júlia Mendes" tamanho="g" />
        </div>
      </Secao>

      <Secao titulo="Cartões">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { t: 'Conversas abertas', n: '12', i: <MessageCircle />, c: 'var(--aba-atendimento)' },
            { t: 'Reuniões analisadas', n: '7', i: <Mic />, c: 'var(--aba-coach)' },
            { t: 'Criações no mês', n: '34', i: <Sparkles />, c: 'var(--aba-estudio)' },
          ].map((x) => (
            <Cartao key={x.t}>
              <CabecalhoCartao titulo={x.t} icone={<span style={{ color: x.c }}>{x.i}</span>} />
              <CorpoCartao>
                <p className="numero text-4xl">{x.n}</p>
              </CorpoCartao>
            </Cartao>
          ))}
        </div>
      </Secao>

      <Secao titulo="Abas">
        <Abas
          abas={[
            { id: 'abertas', rotulo: 'Abertas', contagem: 12 },
            { id: 'humano', rotulo: 'Precisa de humano', contagem: 2 },
            { id: 'minhas', rotulo: 'Minhas' },
            { id: 'resolvidas', rotulo: 'Resolvidas' },
          ]}
          ativa={aba}
          aoMudar={setAba}
        />
      </Secao>

      <Secao titulo="Tabela">
        <Tabela
          linhas={linhas}
          chaveLinha={(l) => l.id}
          aoClicar={(l) => avisar(`Abrindo ${l.nome}`, 'info')}
          colunas={[
            {
              chave: 'nome',
              titulo: 'Nome',
              render: (l) => (
                <span className="flex items-center gap-2.5">
                  <Avatar nome={l.nome} tamanho="p" />
                  {l.nome}
                </span>
              ),
            },
            { chave: 'etapa', titulo: 'Etapa', render: (l) => <Selo tom="acento">{l.etapa}</Selo> },
            { chave: 'origem', titulo: 'Origem', render: (l) => l.origem, ocultarCelular: true },
            { chave: 'valor', titulo: 'Valor', render: (l) => <span className="numero">{l.valor}</span>, className: 'text-right' },
          ]}
        />
      </Secao>

      <Secao titulo="Modal, folha e aviso">
        <div className="flex flex-wrap gap-3">
          <Botao variante="secundario" onClick={() => setModal(true)}>Abrir modal</Botao>
          <Botao variante="secundario" onClick={() => setFolha(true)}>Abrir folha</Botao>
          <Botao variante="secundario" onClick={() => avisar('Horário marcado para amanhã às 10:00.')}>Aviso de sucesso</Botao>
          <Botao variante="secundario" onClick={() => avisar('Não deu para salvar. Tente de novo.', 'erro')}>Aviso de erro</Botao>
        </div>
        <Modal
          aberto={modal}
          aoFechar={() => setModal(false)}
          titulo="Marcar horário"
          descricao="Escolha o serviço e o horário."
          rodape={
            <>
              <Botao variante="fantasma" onClick={() => setModal(false)}>Cancelar</Botao>
              <Botao onClick={() => setModal(false)}>Marcar</Botao>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Campo rotulo="Cliente" placeholder="Nome ou telefone" />
            <Select rotulo="Serviço" opcoes={[{ valor: '1', rotulo: 'Limpeza de pele — 60 min' }]} />
          </div>
        </Modal>
        <Folha aberto={folha} aoFechar={() => setFolha(false)} titulo="Mariana Lopes" descricao="(11) 99123-4001">
          <p className="text-sm text-texto-2">A folha serve para fichas e detalhes, sem sair da lista.</p>
        </Folha>
      </Secao>

      <Secao titulo="Vazio e carregando">
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao>
            <Vazio
              icone={<Users />}
              titulo="Nenhum contato ainda"
              descricao="Importe sua lista de clientes ou espere a primeira conversa no WhatsApp."
              acao={<Botao tamanho="p" icone={<Plus className="size-4" />}>Importar contatos</Botao>}
            />
          </Cartao>
          <Cartao>
            <CorpoCartao className="flex flex-col gap-5">
              <Esqueleto className="h-6 w-40" />
              <EsqueletoLista linhas={3} />
            </CorpoCartao>
          </Cartao>
        </div>
        <Cartao>
          <Vazio icone={<CalendarDays />} titulo="Agenda livre hoje" descricao="Quando alguém marcar, aparece aqui." />
        </Cartao>
      </Secao>
    </div>
  );
}

export function Vitrine() {
  return (
    <ProvedorToast>
      <Conteudo />
    </ProvedorToast>
  );
}
