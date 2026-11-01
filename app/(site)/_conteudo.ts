// Todo o texto do site público num lugar só (fácil de revisar e editar).
// Preços NÃO ficam aqui: vêm de lib/planos/config.ts.

export const MARCA = {
  nome: 'ATENA',
  sobrenome: 'SOLUTION',
  frase: 'Atende, vende e divulga pela sua empresa. 24 horas.',
  emailContato: 'contato@atenasolution.com.br', // CONFIRMAR: domínio ainda não registrado
  whatsappVendas: '', // preencher com o número comercial (só dígitos, com 55)
};

export const HERO = {
  selo: 'Novo · IA que trabalha no seu WhatsApp',
  titulo: ['Seu cliente chamou.', 'A Atena já respondeu.'],
  subtitulo:
    'Atendente de IA no WhatsApp que responde na hora, marca na agenda e lembra o cliente. Coach que dá nota às suas vendas. Estúdio que transforma foto de celular em foto de catálogo. Tudo num lugar só.',
  ctaPrincipal: 'Testar grátis por 7 dias',
  ctaSecundario: 'Ver como funciona',
  provas: ['Sem cartão para testar', 'Pronto em 15 minutos', 'Cancele quando quiser'],
};

/** Conversa da demonstração animada (a IA marcando horário em tempo real). */
export const DEMO_CONVERSA: { de: 'cliente' | 'ia' | 'sistema'; texto: string; espera?: number }[] = [
  { de: 'cliente', texto: 'Oi! Vocês têm horário pra corte amanhã? 😊' },
  { de: 'ia', texto: 'Oi! Tenho sim 💈 Amanhã (quinta) tenho 10h, 14h30 e 18h com o Rafa. Qual fica melhor pra você?', espera: 1800 },
  { de: 'cliente', texto: '18h tá ótimo. Quanto fica corte + barba?' },
  { de: 'ia', texto: 'Corte + barba sai R$ 70 e leva uns 50 minutos. Posso marcar 18h com o Rafa no seu nome?', espera: 1600 },
  { de: 'cliente', texto: 'Pode! É Lucas' },
  { de: 'sistema', texto: 'Agendado · Qui 18:00 · Corte + barba · Rafa' },
  { de: 'ia', texto: 'Prontinho, Lucas! ✅ Quinta às 18h com o Rafa. Te mando um lembrete na véspera. Até lá!', espera: 1400 },
];

export const NUMEROS = [
  { valor: '< 10 s', rotulo: 'para responder o cliente novo, até de madrugada' },
  { valor: '24/7', rotulo: 'atendendo, inclusive feriado e fim de semana' },
  { valor: '3 em 1', rotulo: 'atendimento, vendas e conteúdo na mesma plataforma' },
];

export const ABAS = [
  {
    id: 'atendimento',
    cor: 'var(--s-agua)',
    nome: 'Atendimento',
    titulo: 'Ninguém fica sem resposta.',
    texto:
      'A IA responde o cliente novo no WhatsApp na hora, tira dúvidas com o que você ensinou, marca na agenda, confirma, lembra na véspera, recupera quem faltou e pede avaliação no Google. Sua equipe vê tudo ao vivo e assume a conversa com um toque.',
    itens: ['Resposta em segundos, 24h', 'Marca, confirma e lembra horários', 'Recupera faltas no mesmo dia', 'Você assume quando quiser'],
  },
  {
    id: 'coach',
    cor: 'var(--s-violeta)',
    nome: 'Coach de Vendas',
    titulo: 'Cada reunião vira aprendizado.',
    texto:
      'Grave a reunião ou ligação de venda. A Atena transcreve, dá nota ao vendedor contra o seu roteiro, mostra as objeções e a melhor resposta para cada uma e já escreve o follow-up. O dono vê o placar da equipe toda semana.',
    itens: ['Nota de 0 a 10 por reunião', 'Objeções e como responder', 'Follow-up pronto pro WhatsApp', 'Placar da equipe'],
  },
  {
    id: 'estudio',
    cor: 'var(--s-ambar)',
    nome: 'Estúdio',
    titulo: 'Foto de celular, cara de catálogo.',
    texto:
      'Tire a foto do produto no celular. O Estúdio entrega fotos profissionais, posts e vídeos curtos com a sua logo, as suas cores e o seu jeito de falar. Fiel ao produto de verdade, sem inventar detalhe.',
    itens: ['Fotos com fundo e cenário', 'Posts com a sua marca', 'Vídeos curtos verticais', 'Calendário de conteúdo do mês'],
  },
];

export const COMO_FUNCIONA = [
  { n: '1', titulo: 'Conte sobre a sua empresa', texto: 'Serviços, preços, horários e as perguntas que mais chegam. Leva uns 10 minutos.' },
  { n: '2', titulo: 'Conecte o seu WhatsApp', texto: 'O mesmo número que seus clientes já conhecem. Teste antes no simulador.' },
  { n: '3', titulo: 'A Atena começa a trabalhar', texto: 'Responde, agenda e lembra. Você acompanha tudo pelo celular.' },
];

export interface Segmento {
  slug: string;
  nome: string;
  titulo: string;
  dor: string;
  subtitulo: string;
  ganhos: { titulo: string; texto: string }[];
  exemplo: { cliente: string; ia: string };
  planoSugerido: 'atendimento' | 'coach' | 'estudio' | 'completo';
}

export const SEGMENTOS: Segmento[] = [
  {
    slug: 'clinicas',
    nome: 'Clínicas e consultórios',
    titulo: 'Sua agenda cheia, sem a recepção parar.',
    dor: 'Paciente que manda mensagem às 22h e só recebe resposta no dia seguinte já marcou em outro lugar.',
    subtitulo: 'A Atena responde o paciente na hora, explica o procedimento com as suas palavras, marca a consulta e confirma na véspera. Menos faltas, mais agenda cheia.',
    ganhos: [
      { titulo: 'Confirmação automática', texto: 'Lembrete na véspera e 1h antes. O paciente confirma com um "SIM".' },
      { titulo: 'Menos faltas', texto: 'Quem faltou recebe uma mensagem no mesmo dia para remarcar.' },
      { titulo: 'Assunto sensível vai para a equipe', texto: 'Dúvida clínica, reclamação ou urgência: a IA chama alguém na hora.' },
      { titulo: 'Avaliação no Google', texto: 'Depois da consulta, a Atena pede a avaliação. Sua nota sobe sozinha.' },
    ],
    exemplo: { cliente: 'Boa noite, quanto custa a limpeza de pele? Tem horário sábado?', ia: 'Boa noite! A limpeza de pele profunda sai R$ 180 e dura 1h. Sábado tenho 9h e 11h com a Dra. Paula. Quer que eu reserve?' },
    planoSugerido: 'atendimento',
  },
  {
    slug: 'barbearias-estetica',
    nome: 'Barbearias, salões e estética',
    titulo: 'Cadeira ocupada, celular respondido.',
    dor: 'Você está com a tesoura na mão e o WhatsApp não para. Cada mensagem sem resposta é um cliente a menos.',
    subtitulo: 'A Atena marca, remarca e lembra os horários enquanto você atende. E o Estúdio faz as fotos dos cortes e procedimentos para o Instagram.',
    ganhos: [
      { titulo: 'Agenda por profissional', texto: 'A IA sabe quem faz o quê e quanto tempo leva cada serviço.' },
      { titulo: 'Horário vago vira horário vendido', texto: 'Desmarcou? A Atena oferece o horário para quem pediu.' },
      { titulo: 'Fotos que vendem', texto: 'Antes e depois e posts com a sua marca, prontos para postar.' },
      { titulo: 'Cliente que some, volta', texto: 'Lembrete de retorno no tempo certo de cada serviço.' },
    ],
    exemplo: { cliente: 'Tem horário pra sobrancelha hoje?', ia: 'Tem sim! Hoje às 16h ou 17h30 com a Bia. A design de sobrancelha sai R$ 45. Qual prefere?' },
    planoSugerido: 'completo',
  },
  {
    slug: 'imobiliarias',
    nome: 'Imobiliárias e corretores',
    titulo: 'Todo lead atendido. Toda visita marcada.',
    dor: 'O lead do portal chega, ninguém responde em 5 minutos e ele já está falando com outra imobiliária.',
    subtitulo: 'A Atena qualifica o lead na hora (região, valor, financiamento), agenda a visita e passa para o corretor. O Coach mostra onde cada corretor perde a venda.',
    ganhos: [
      { titulo: 'Qualificação automática', texto: 'Perfil, faixa de preço e prazo anotados na ficha do contato.' },
      { titulo: 'Visita na agenda do corretor', texto: 'Sem troca infinita de mensagens para achar um horário.' },
      { titulo: 'Corretor melhor a cada semana', texto: 'Nota, objeções e follow-up de cada atendimento.' },
      { titulo: 'Funil do começo ao fim', texto: 'Do primeiro contato à assinatura, tudo num quadro só.' },
    ],
    exemplo: { cliente: 'Vi o apartamento de 2 quartos no Centro. Ainda tá disponível?', ia: 'Está sim! É o de R$ 420 mil, com vaga. Você pretende financiar? Posso marcar uma visita amanhã às 10h ou 15h.' },
    planoSugerido: 'completo',
  },
  {
    slug: 'lojas',
    nome: 'Lojas e e-commerce',
    titulo: 'Venda no WhatsApp até com a loja fechada.',
    dor: 'Pergunta de preço, tamanho e entrega chega o dia todo. Quem demora para responder perde a venda.',
    subtitulo: 'A Atena responde preço, tamanho, prazo e forma de pagamento na hora. O Estúdio transforma a foto do celular em foto de catálogo para o Instagram e marketplaces.',
    ganhos: [
      { titulo: 'Resposta de preço na hora', texto: 'Com os seus produtos e preços, sem inventar nada.' },
      { titulo: 'Foto de catálogo sem estúdio', texto: 'Fundo limpo, ambientada, modelo usando. Fiel ao produto.' },
      { titulo: 'Posts e vídeos do mês', texto: 'Calendário com as datas que vendem no seu segmento.' },
      { titulo: 'Equipe de vendas afiada', texto: 'O Coach mostra como fechar mais no WhatsApp e no telefone.' },
    ],
    exemplo: { cliente: 'Esse vestido tem no M? Entrega em Campinas?', ia: 'Tem no M sim! 💛 Entregamos em Campinas em até 2 dias úteis, frete R$ 15. Quer que eu separe o seu?' },
    planoSugerido: 'completo',
  },
];

export const PERGUNTAS: { p: string; r: string }[] = [
  { p: 'A IA vai falar besteira para o meu cliente?', r: 'Ela só responde com o que você ensinou: serviços, preços, horários e as suas regras. Nunca inventa preço ou serviço. Se não souber, ou se for reclamação ou assunto sensível, ela chama alguém da sua equipe na hora.' },
  { p: 'O cliente vai saber que é uma IA?', r: 'Ela se apresenta como a assistente da sua empresa e, se perguntarem, diz que é uma assistente virtual. Fala de forma natural, em mensagens curtas, uma pergunta por vez.' },
  { p: 'Preciso trocar o meu número de WhatsApp?', r: 'Não. Você conecta o número da empresa pela API oficial do WhatsApp (Meta). A gente te guia passo a passo.' },
  { p: 'Minha equipe consegue responder também?', r: 'Sim. Todo mundo vê as conversas ao vivo. Com um toque em "Assumir", a IA pausa naquela conversa e a pessoa responde. Depois é só "Devolver pra IA".' },
  { p: 'Como funciona o teste grátis?', r: '7 dias com todas as abas liberadas, sem cartão. No fim, você escolhe o plano. Se não escolher, sua conta fica só em leitura: nada é apagado.' },
  { p: 'Posso contratar só uma aba?', r: 'Pode. Atendimento, Coach e Estúdio são vendidos separados. O Pacote completo junta as três com desconto.' },
  { p: 'Como eu pago?', r: 'Pix, boleto ou cartão, por mês ou por ano (com desconto). A cobrança é feita pelo Asaas, com nota e recibo.' },
  { p: 'E se eu quiser cancelar?', r: 'Cancela pelo próprio painel, sem multa. Você continua usando até o fim do período já pago.' },
  { p: 'Meus dados ficam seguros?', r: 'Cada empresa só enxerga os próprios dados. Seguimos a LGPD: você pode pedir a exportação ou a exclusão a qualquer momento.' },
  { p: 'O que são os créditos do Estúdio?', r: 'Cada foto, post ou vídeo gerado usa créditos. Os planos com Estúdio já vêm com créditos todo mês, e você pode comprar pacotes extras. Os créditos não expiram enquanto você tiver plano.' },
];

export const CTA_FINAL = {
  titulo: 'Comece hoje. Seu próximo cliente já está digitando.',
  texto: '7 dias grátis com tudo liberado. Sem cartão, sem fidelidade.',
  botao: 'Criar minha conta grátis',
};
