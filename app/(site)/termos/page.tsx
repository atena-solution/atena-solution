import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Termos de uso' };

// RASCUNHO — revisar com advogado antes de publicar.
export default function Termos() {
  return (
    <section className="s-secao">
      <div className="s-container">
        <p className="s-sobretitulo">Rascunho · versão de 01/11/2026</p>
        <h1 className="s-titulo-xl mt-3">Termos de uso</h1>
        <div className="s-prosa mt-10">
          <p>Estes termos valem para quem usa a plataforma ATENA SOLUTION (“Atena”). Ao criar uma conta, você concorda com eles em nome da sua empresa.</p>
          <h2>1. O que a Atena faz</h2>
          <p>A Atena oferece, por assinatura, as abas Atendimento (assistente de IA no WhatsApp e agenda), Coach de Vendas (gravação, transcrição e análise de reuniões) e Estúdio (geração de imagens, posts e vídeos), além de contatos e funil. Você contrata uma aba ou o pacote.</p>
          <h2>2. Conta e equipe</h2>
          <ul>
            <li>O dono da conta responde pelos acessos que der à equipe e pelos dados que colocar na plataforma.</li>
            <li>Mantenha senha e acessos em segurança. Avise a gente se perceber uso indevido.</li>
          </ul>
          <h2>3. Teste grátis, pagamento e cancelamento</h2>
          <ul>
            <li>O teste grátis dura 7 dias, sem cartão. No fim, é preciso escolher um plano para continuar criando.</li>
            <li>A cobrança é mensal ou anual, antecipada, feita pelo Asaas (Pix, boleto ou cartão). O plano só é liberado depois que o pagamento é confirmado.</li>
            <li>Se o pagamento atrasar, você recebe aviso e tem 3 dias de carência. Depois, a conta fica só em leitura: nada é apagado, mas a IA para de responder e nada novo é criado até o pagamento.</li>
            <li>Você pode cancelar a qualquer momento pelo painel, sem multa. O acesso continua até o fim do período pago. Não há reembolso proporcional de período já iniciado, salvo o que a lei garantir.</li>
            <li>Créditos do Estúdio não expiram enquanto houver plano ativo e não são convertidos em dinheiro.</li>
          </ul>
          <h2>4. Uso da inteligência artificial</h2>
          <ul>
            <li>A IA responde com base no que a sua empresa ensinou. Revise o treino e use o simulador antes de ligar no WhatsApp.</li>
            <li>A IA pode errar. A responsabilidade pelas informações passadas aos seus clientes (preços, prazos, orientações) é da sua empresa. Assuntos sensíveis devem ser configurados para ir à equipe.</li>
            <li>Gravações de reuniões exigem que você informe e obtenha a concordância dos participantes, conforme a lei.</li>
            <li>No Estúdio, use apenas fotos e marcas que você tem direito de usar.</li>
          </ul>
          <h2>5. WhatsApp</h2>
          <p>A conexão usa a API oficial do WhatsApp (Meta). Você precisa seguir as políticas da Meta, inclusive sobre mensagens fora da janela de 24 horas e envio de modelos aprovados. Custos cobrados pela Meta por conversa, se houver, são da sua empresa.</p>
          <h2>6. Uso proibido</h2>
          <p>Não é permitido usar a Atena para spam, golpes, conteúdo ilegal, discriminação, ou para enviar mensagens a quem não pediu para receber.</p>
          <h2>7. Disponibilidade</h2>
          <p>Trabalhamos para manter a plataforma no ar o tempo todo, mas podem ocorrer paradas para manutenção ou por falha de serviços de terceiros (Meta, provedores de IA, hospedagem).</p>
          <h2>8. Dados</h2>
          <p>O tratamento de dados pessoais segue a nossa <a href="/privacidade" className="underline">Política de Privacidade</a>.</p>
          <h2>9. Mudanças</h2>
          <p>Podemos atualizar estes termos e os preços, avisando com pelo menos 30 dias de antecedência quando a mudança afetar a sua assinatura.</p>
          <h2>10. Foro</h2>
          <p>Fica eleito o foro da comarca da sede da Atena, salvo regra diferente do Código de Defesa do Consumidor. [PREENCHER: razão social, CNPJ e endereço]</p>
        </div>
      </div>
    </section>
  );
}
