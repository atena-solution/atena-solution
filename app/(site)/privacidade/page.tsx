import type { Metadata } from 'next';
import { MARCA } from '../_conteudo';

export const metadata: Metadata = { title: 'Política de Privacidade (LGPD)' };

// RASCUNHO — revisar com advogado / encarregado de dados antes de publicar.
export default function Privacidade() {
  return (
    <section className="s-secao">
      <div className="s-container">
        <p className="s-sobretitulo">Rascunho · versão de 01/11/2026</p>
        <h1 className="s-titulo-xl mt-3">Privacidade</h1>
        <div className="s-prosa mt-10">
          <p>Esta política explica como a ATENA SOLUTION trata dados pessoais, conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
          <h2>1. Quem é quem</h2>
          <ul>
            <li><strong>Dados da sua empresa e da sua equipe</strong> (cadastro, login, pagamento): a Atena é a <em>controladora</em>.</li>
            <li><strong>Dados dos seus clientes</strong> (conversas de WhatsApp, contatos, agendamentos, gravações de reuniões): a sua empresa é a <em>controladora</em> e a Atena é a <em>operadora</em>, tratando os dados só para prestar o serviço contratado.</li>
          </ul>
          <h2>2. Quais dados</h2>
          <ul>
            <li>Cadastro: nome, e-mail, telefone, CPF/CNPJ (para cobrança), dados da empresa.</li>
            <li>Uso da plataforma: registros de acesso, ações realizadas, uso de créditos.</li>
            <li>Conteúdo que você ou seus clientes enviam: mensagens, áudios, imagens, gravações e transcrições.</li>
          </ul>
          <h2>3. Para quê</h2>
          <ul>
            <li>Prestar o serviço (responder clientes, agendar, analisar reuniões, gerar imagens).</li>
            <li>Cobrança e emissão de notas.</li>
            <li>Segurança, prevenção a fraudes e suporte.</li>
            <li>Melhorar o produto com dados agregados. <strong>Não usamos o conteúdo dos seus clientes para treinar modelos de IA.</strong></li>
          </ul>
          <h2>4. Com quem compartilhamos</h2>
          <p>Apenas com fornecedores necessários para o serviço, sob contrato: hospedagem e banco de dados (Google Cloud / Firebase, Vercel), provedores de IA (Anthropic, Google), WhatsApp (Meta) e cobrança (Asaas). Alguns ficam fora do Brasil; nesses casos, exigimos garantias adequadas de proteção.</p>
          <h2>5. Isolamento entre empresas</h2>
          <p>Cada empresa só acessa os próprios dados. O acesso da equipe da Atena aos dados de clientes é restrito a suporte e segurança, e registrado.</p>
          <h2>6. Por quanto tempo</h2>
          <p>Enquanto a conta estiver ativa. Após o cancelamento, os dados ficam disponíveis por 90 dias para exportação e depois são apagados, exceto o que a lei mandar guardar (como dados fiscais).</p>
          <h2>7. Seus direitos</h2>
          <p>Você pode pedir confirmação, acesso, correção, exportação, anonimização ou exclusão dos dados, e revogar consentimentos. Clientes finais da sua empresa podem exercer esses direitos com a sua empresa, e nós ajudamos no que for preciso.</p>
          <h2>8. Contato</h2>
          <p>Encarregado de dados (DPO): {MARCA.emailContato}. [PREENCHER: nome do encarregado]</p>
        </div>
      </div>
    </section>
  );
}
