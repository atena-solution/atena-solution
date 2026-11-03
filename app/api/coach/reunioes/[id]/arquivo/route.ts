// POST: processa UM passo do arquivo enviado (sobe pro Gemini ou transcreve a próxima janela de 10 min).
// A tela chama em sequência até `terminou`, depois chama /analisar.
import { armazenamento, autenticar, contarSegundosCoach, exigirCoach, repositorio, responder, usoDaEmpresa } from '@/lib/coach/servidor';
import { processarArquivo } from '@/lib/coach/servico';
import { enviarArquivoGemini, simulando, transcreverArquivo } from '@/lib/integracoes/gemini';

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return responder(async () => {
    const { id } = await params;
    const s = await autenticar(req);
    await exigirCoach(s.empresaId);
    const usar = usoDaEmpresa(s.empresaId);
    const arm = await armazenamento();
    const r = await processarArquivo(s, await repositorio(), id, {
      lerArquivo: (c) => arm.ler(c),
      enviarGemini: async (bytes, mime, nome) =>
        simulando() ? { uri: 'simulado://arquivo', mimeType: mime } : enviarArquivoGemini(bytes, mime, nome),
      transcreverJanela: async (arq, j) => {
        const falas = await transcreverArquivo(simulando() ? null : arq, [j], 'misto');
        await usar('gemini-transcricao', { segundosAudio: Math.round(j.fimSeg - j.inicioSeg) });
        await contarSegundosCoach(s.empresaId, j.fimSeg - j.inicioSeg);
        return falas;
      },
    });
    return { feitas: r.feitas, total: r.total, terminou: r.terminou, status: r.reuniao.status };
  });
}
