'use client';
import { useEffect, useState } from 'react';
import { Camera, Download, RefreshCw, Sparkles, Wand2 } from 'lucide-react';
import { custoDe, MAX_VARIACOES } from '@/lib/estudio/creditos';
import { FORMATOS, ROTULO_ESTILO } from '@/lib/estudio/prompts';
import { nomeArquivo } from '@/lib/estudio/galeria';
import type { Criacao, EstiloFoto, Formato } from '@/lib/estudio/tipos';
import { avisarSaldo, baixar, chamar, ErroApi, paraPng } from '../_componentes/cliente';
import { EnviarFotos } from '../_componentes/EnviarFotos';
import { Aviso, Botao, Campo, Cartao, Custo, LinkBotao, Opcoes, Titulo } from '../_componentes/ui';

const DESCRICAO: Record<EstiloFoto, string> = {
  'fundo-limpo': 'Estúdio, fundo liso',
  ambientada: 'No ambiente de uso',
  modelo: 'Pessoa usando',
  'flat-lay': 'Vista de cima',
  detalhe: 'Close na textura',
};

export default function FotoPage() {
  const [fotos, setFotos] = useState<string[]>([]);
  const [produto, setProduto] = useState('');
  const [detalhes, setDetalhes] = useState('');
  const [estilo, setEstilo] = useState<EstiloFoto>('fundo-limpo');
  const [formato, setFormato] = useState<Formato>('4:5');
  const [quantidade, setQuantidade] = useState(2);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<Criacao | null>(null);

  useEffect(() => {
    chamar<{ saldo: number }>('/api/estudio/creditos').then((r) => setSaldo(r.saldo)).catch(() => {});
    // Reaproveitar: ?origem=<id> traz as fotos de uma criação da galeria.
    const origem = new URLSearchParams(location.search).get('origem');
    if (origem) chamar<{ criacao: Criacao }>(`/api/estudio/galeria/${origem}`).then(({ criacao }) => {
      setFotos((criacao.tipo === 'foto' ? criacao.arquivos : criacao.origem ?? criacao.arquivos).filter((u) => !u.startsWith('data:video')).slice(0, 5));
      setProduto(criacao.titulo);
    }).catch(() => {});
  }, []);

  const custo = custoDe('foto', quantidade);

  async function gerar() {
    setErro('');
    setGerando(true);
    setResultado(null);
    try {
      const r = await chamar<{ criacao: Criacao; saldo: number }>('/api/estudio/foto', { corpo: { fotos, produto, detalhes, estilo, formato, quantidade } });
      setResultado(r.criacao);
      setSaldo(r.saldo);
      avisarSaldo(r.saldo);
      if (r.criacao.status === 'falhou') setErro(r.criacao.erro ?? 'Não deu certo. Os créditos foram devolvidos.');
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Sem conexão. Tente de novo.');
    } finally {
      setGerando(false);
    }
  }

  async function baixarImagem(url: string, i: number) {
    if (!resultado) return;
    const { largura, altura } = FORMATOS[resultado.formato ?? '1:1'];
    baixar(await paraPng(url, largura, altura), nomeArquivo(resultado, i));
  }

  const proporcao = { '1:1': 'aspect-square', '3:4': 'aspect-[3/4]', '4:5': 'aspect-[4/5]', '9:16': 'aspect-[9/16]' }[resultado?.formato ?? formato];

  return (
    <>
      <Titulo titulo="Foto de produto" descricao="Suba fotos reais do produto. A Atena muda só o fundo, a luz e o cenário — cor, estampa e forma ficam idênticas." />
      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <div className="space-y-6">
          <Cartao className="p-5 space-y-6">
            <EnviarFotos fotos={fotos} aoMudar={setFotos} />
            <Campo rotulo="O que é o produto?" dica="Ajuda a IA a entender. Ex.: “tênis branco de couro”." valor={produto} aoMudar={setProduto} max={120} placeholder="Ex.: vela aromática em pote de vidro" />
          </Cartao>
          <Cartao className="p-5 space-y-6">
            <Opcoes rotulo="Estilo" valor={estilo} aoMudar={setEstilo} opcoes={(Object.keys(ROTULO_ESTILO) as EstiloFoto[]).map((v) => ({ valor: v, titulo: ROTULO_ESTILO[v], descricao: DESCRICAO[v] }))} />
            <Opcoes rotulo="Formato" valor={formato} aoMudar={setFormato} colunas="grid-cols-2 sm:grid-cols-4" opcoes={(Object.keys(FORMATOS) as Formato[]).map((v) => ({ valor: v, titulo: v, descricao: FORMATOS[v].rotulo }))} />
            <Campo rotulo="Algum pedido? (opcional)" valor={detalhes} aoMudar={setDetalhes} max={300} placeholder="Ex.: cenário de banheiro claro, com plantas" dica="O produto nunca é alterado, mesmo que o pedido diga o contrário." />
          </Cartao>
        </div>

        <div className="lg:sticky lg:top-20 space-y-4">
          <Cartao className="p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Variações</span>
                <span className="e-mono">{quantidade}</span>
              </div>
              <input type="range" min={1} max={MAX_VARIACOES} value={quantidade} onChange={(e) => setQuantidade(Number(e.target.value))} className="w-full accent-[var(--e-acento)]" aria-label="Quantidade de variações" />
            </div>
            <Custo creditos={custo} saldo={saldo} />
            <Botao className="w-full h-11" onClick={gerar} carregando={gerando} disabled={!fotos.length || (saldo != null && saldo < custo)} icone={<Wand2 className="size-4" />}>
              {gerando ? 'Gerando fotos…' : 'Gerar fotos'}
            </Botao>
            {!fotos.length && <p className="text-xs text-[var(--e-suave)] text-center">Adicione pelo menos 1 foto para começar.</p>}
            {saldo != null && saldo < custo && <LinkBotao href="/estudio/creditos" className="w-full">Ver créditos</LinkBotao>}
            <p className="text-xs text-[var(--e-suave)]">Se alguma variação falhar, os créditos dela voltam na hora.</p>
          </Cartao>
          {erro && <Aviso>{erro}</Aviso>}
        </div>
      </div>

      {(gerando || resultado?.arquivos.length) ? (
        <section className="mt-10" aria-live="polite">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium flex items-center gap-2"><Sparkles className="size-4 text-[var(--e-acento)]" aria-hidden />Resultado</h2>
            {resultado && <Botao variante="fantasma" onClick={gerar} icone={<RefreshCw className="size-4" />}>Gerar de novo</Botao>}
          </div>
          {resultado?.erro && resultado.status === 'pronta' && <div className="mb-3"><Aviso tom="info">{resultado.erro}</Aviso></div>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {gerando
              ? Array.from({ length: quantidade }, (_, i) => <div key={i} className={`${proporcao} rounded-[12px] e-esqueleto`} />)
              : resultado!.arquivos.map((u, i) => (
                  <figure key={i} className="group relative rounded-[12px] overflow-hidden border border-[var(--e-borda)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u} alt={`Variação ${i + 1}`} className={`${proporcao} w-full object-cover`} />
                    <div className="absolute inset-x-0 bottom-0 p-2 flex gap-2 justify-end bg-gradient-to-t from-black/50 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition">
                      <Botao variante="secundario" className="h-8 px-3" onClick={() => baixarImagem(u, i)} icone={<Download className="size-4" />}>Baixar</Botao>
                    </div>
                  </figure>
                ))}
          </div>
          {resultado && (
            <div className="flex flex-wrap gap-2 mt-4">
              <LinkBotao href={`/estudio/post?origem=${resultado.id}`} icone={<Sparkles className="size-4" />}>Usar num post</LinkBotao>
              <LinkBotao href={`/estudio/video?origem=${resultado.id}`} icone={<Camera className="size-4" />}>Fazer vídeo</LinkBotao>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
