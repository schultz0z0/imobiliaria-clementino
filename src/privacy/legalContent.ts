export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface CookieTechnology {
  name: string;
  category: string;
  provider: string;
  purpose: string;
  duration: string;
  status: 'Ativo' | 'Condicionado ao consentimento' | 'Não instalado';
}

export const privacyNoticeSections: LegalSection[] = [
  {
    id: 'controlador',
    title: '1. Quem trata seus dados',
    paragraphs: [
      'A Claudionor Clementino Imóveis Ltda, nome fantasia Imobiliária Clementino Ltda, é a responsável pelo tratamento de dados pessoais realizado neste site e nos atendimentos iniciados por seus canais oficiais. Os dados completos do controlador e o canal de privacidade estão disponíveis ao final deste aviso.',
      'Este aviso se aplica à navegação no site, à consulta de imóveis e aos contatos que o visitante decide iniciar. Plataformas externas acessadas por links próprios, como WhatsApp e Google Maps, possuem regras de privacidade próprias.',
    ],
  },
  {
    id: 'dados-tratados',
    title: '2. Dados que podemos tratar',
    paragraphs: [
      'Tratamos apenas os dados adequados às finalidades descritas neste aviso. O tipo de dado depende da forma como você utiliza o site ou entra em contato com a imobiliária.',
    ],
    bullets: [
      'Dados informados por você: nome, telefone, e-mail, assunto, mensagem, interesse em imóveis e outras informações incluídas voluntariamente no atendimento.',
      'Dados do imóvel e da negociação: preferências de busca, imóvel de interesse e informações necessárias para compra, venda, locação, avaliação, administração ou regularização.',
      'Dados técnicos: endereço IP, data e hora de acesso, navegador, dispositivo e registros de segurança que podem ser gerados automaticamente pela infraestrutura de hospedagem.',
      'Preferências de privacidade: categorias autorizadas e data da escolha, armazenadas localmente no navegador.',
    ],
  },
  {
    id: 'origem',
    title: '3. Como os dados são obtidos',
    paragraphs: [
      'Os dados podem ser fornecidos diretamente por você ao preparar uma mensagem no site, iniciar uma conversa no WhatsApp, solicitar atendimento ou participar de uma negociação. Também podem surgir da relação com proprietários, interessados, representantes e prestadores envolvidos no serviço imobiliário.',
      'O formulário do site não envia sua mensagem para um banco de dados próprio: ele organiza o texto no navegador e abre o WhatsApp para que você revise e decida se deseja enviá-lo.',
    ],
  },
  {
    id: 'finalidades-bases',
    title: '4. Finalidades e bases legais',
    paragraphs: [
      'Os dados podem ser utilizados para responder solicitações, identificar imóveis compatíveis, organizar visitas, apoiar negociações, executar serviços imobiliários, cumprir obrigações legais e regulatórias, exercer direitos, prevenir fraude e manter a segurança do site.',
      'Conforme o caso, o tratamento poderá se apoiar em procedimentos preliminares ou execução de contrato, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, legítimo interesse avaliado de forma proporcional e consentimento. O consentimento será utilizado para tecnologias opcionais quando essa for a base adequada.',
    ],
  },
  {
    id: 'whatsapp-mapas',
    title: '5. WhatsApp, mapas e serviços externos',
    paragraphs: [
      'Ao escolher falar pelo WhatsApp, você será direcionado a um serviço da Meta. O envio só ocorre quando você confirma a mensagem no aplicativo ou site do WhatsApp. A partir desse momento, a plataforma também tratará dados segundo seus próprios termos.',
      'O Google Maps incorporado permanece bloqueado até a autorização da categoria de funcionalidade. O link externo para abrir o endereço no Google Maps somente é acionado quando você decide clicar nele.',
    ],
  },
  {
    id: 'compartilhamento',
    title: '6. Com quem os dados podem ser compartilhados',
    paragraphs: [
      'Podemos compartilhar dados, no limite necessário, com provedores de hospedagem e tecnologia, WhatsApp/Meta quando você utiliza esse canal, Google quando você autoriza ou abre o mapa, profissionais que apoiem a operação imobiliária e autoridades públicas quando houver obrigação legal ou solicitação válida.',
      'Não vendemos dados pessoais. Fornecedores recebem apenas o necessário para sua função e devem observar deveres de segurança e proteção de dados compatíveis com o serviço prestado.',
    ],
  },
  {
    id: 'transferencias',
    title: '7. Tratamento fora do Brasil',
    paragraphs: [
      'Alguns fornecedores globais, como Google e Meta, podem processar dados em outros países. Quando esses serviços forem utilizados, buscamos restringir o tratamento à finalidade informada e considerar mecanismos de proteção admitidos pela legislação aplicável.',
    ],
  },
  {
    id: 'retencao',
    title: '8. Por quanto tempo os dados são mantidos',
    paragraphs: [
      'Os dados são mantidos pelo tempo necessário ao atendimento, à relação contratual, ao cumprimento de obrigações legais e regulatórias, à defesa de direitos e à prevenção de fraude. Depois desse período, serão eliminados ou anonimizados, salvo quando a conservação for autorizada ou exigida por lei.',
      'A preferência de cookies fica no próprio navegador até ser apagada, substituída por uma nova escolha ou invalidada por uma mudança relevante na versão do consentimento.',
    ],
  },
  {
    id: 'seguranca',
    title: '9. Segurança da informação',
    paragraphs: [
      'Adotamos medidas técnicas e administrativas proporcionais ao contexto para reduzir riscos de acesso não autorizado, perda, alteração ou divulgação indevida. Nenhum ambiente é totalmente imune a incidentes; por isso, controles e práticas devem ser revistos conforme a operação evolui.',
    ],
  },
  {
    id: 'direitos',
    title: '10. Seus direitos',
    paragraphs: [
      'Nos termos da LGPD, você pode solicitar informações e exercer direitos relacionados aos seus dados pessoais. A identidade do solicitante poderá ser confirmada antes do atendimento, para proteger os próprios dados.',
    ],
    bullets: [
      'Confirmação da existência de tratamento e acesso aos dados.',
      'Correção de dados incompletos, inexatos ou desatualizados.',
      'Anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade.',
      'Portabilidade, quando aplicável e conforme regulamentação.',
      'Informação sobre compartilhamentos e sobre a possibilidade de não consentir.',
      'Revogação do consentimento e eliminação dos dados tratados com essa base, observadas as hipóteses legais de conservação.',
      'Oposição a tratamento realizado em desconformidade com a LGPD e revisão de decisões automatizadas, quando aplicável.',
    ],
  },
  {
    id: 'criancas',
    title: '11. Crianças e adolescentes',
    paragraphs: [
      'O site não é direcionado a crianças. Caso um atendimento envolva dados de criança ou adolescente, o tratamento deverá observar seu melhor interesse e os requisitos legais aplicáveis, inclusive a participação de responsável quando necessária.',
    ],
  },
  {
    id: 'cookies',
    title: '12. Cookies e preferências',
    paragraphs: [
      'As tecnologias necessárias e opcionais utilizadas pelo site, seus estados atuais e as formas de aceitar, rejeitar ou retirar autorizações estão detalhadas na Política de Cookies. O painel de preferências também pode ser reaberto pelo rodapé a qualquer momento.',
    ],
  },
  {
    id: 'contato',
    title: '13. Contato e atualizações',
    paragraphs: [
      'Pedidos relacionados a privacidade e proteção de dados podem ser enviados para claudionorclementinoimoveis@gmail.com. Para facilitar o atendimento, descreva sua solicitação e informe um meio de retorno.',
      'Este aviso poderá ser atualizado para refletir mudanças legais, operacionais ou tecnológicas. A versão vigente e a data da última atualização permanecerão publicadas nesta página.',
    ],
  },
];

export const cookiePolicySections: LegalSection[] = [
  {
    id: 'conceito',
    title: '1. O que são cookies e tecnologias semelhantes',
    paragraphs: [
      'Cookies são pequenos arquivos ou identificadores armazenados ou lidos no dispositivo durante a navegação. O site também pode usar tecnologias semelhantes, como armazenamento local do navegador, para lembrar escolhas e viabilizar funções específicas.',
    ],
  },
  {
    id: 'categorias',
    title: '2. Categorias adotadas',
    paragraphs: [
      'Estritamente necessários mantêm funções essenciais e o registro das preferências. Funcionalidade libera recursos externos opcionais, como o mapa. Análise e desempenho poderá medir o uso do site. Publicidade poderá apoiar campanhas, conversões e remarketing.',
      'As categorias de funcionalidade, análise e publicidade começam desligadas. A infraestrutura do Google Analytics permanece inativa sem um Measurement ID válido e sem autorização para análise; publicidade continua preparada apenas para uso futuro.',
    ],
  },
  {
    id: 'tecnologias',
    title: '3. Tecnologias utilizadas',
    paragraphs: [
      'A tabela desta página diferencia tecnologias ativas, recursos condicionados ao consentimento e integrações ainda não instaladas. Ela deverá ser atualizada sempre que um novo fornecedor ou finalidade entrar em operação.',
    ],
  },
  {
    id: 'gerenciar',
    title: '4. Como gerenciar suas escolhas',
    paragraphs: [
      'Na primeira visita, você pode aceitar todas as categorias, rejeitar as não essenciais ou personalizar cada finalidade. O botão “Preferências de cookies” no rodapé permite revisar ou retirar o consentimento a qualquer momento.',
      'A retirada não invalida tratamentos realizados legitimamente antes da mudança. Depois da nova escolha, o site deixa de autorizar novos carregamentos das categorias desativadas, respeitadas limitações técnicas de serviços que já tenham sido abertos.',
    ],
  },
  {
    id: 'navegador',
    title: '5. Controles do navegador',
    paragraphs: [
      'Seu navegador também permite apagar ou bloquear cookies e dados de sites. O caminho varia conforme o aplicativo. A remoção do registro de consentimento fará o banner aparecer novamente, e o bloqueio de tecnologias necessárias pode impedir que a preferência seja lembrada.',
    ],
  },
  {
    id: 'atualizacoes',
    title: '6. Atualizações e contato',
    paragraphs: [
      'Esta política poderá mudar quando novas tecnologias forem instaladas, finalidades forem alteradas ou houver atualização regulatória. Dúvidas podem ser enviadas para claudionorclementinoimoveis@gmail.com.',
    ],
  },
];

export const cookieTechnologies: CookieTechnology[] = [
  {
    name: 'clementino.cookie-consent',
    category: 'Estritamente necessários',
    provider: 'Imobiliária Clementino Ltda (armazenamento local)',
    purpose: 'Guardar a versão, a data e as categorias escolhidas pelo visitante.',
    duration: 'Até a limpeza dos dados do navegador ou mudança relevante da versão.',
    status: 'Ativo',
  },
  {
    name: 'Google Maps',
    category: 'Funcionalidade',
    provider: 'Google',
    purpose: 'Exibir o mapa incorporado da localização informada no anúncio.',
    duration: 'Definida pelo Google após o carregamento autorizado.',
    status: 'Condicionado ao consentimento',
  },
  {
    name: 'Google Analytics',
    category: 'Análise e desempenho',
    provider: 'Google',
    purpose: 'Medir visitas e interações sem enviar os dados digitados nos formulários, somente após configuração e autorização.',
    duration: 'Definida pelo Google quando houver Measurement ID válido e consentimento para análise.',
    status: 'Condicionado ao consentimento',
  },
  {
    name: 'Google Ads e Meta Pixel',
    category: 'Publicidade',
    provider: 'Google e Meta',
    purpose: 'Medição futura de campanhas, conversões e remarketing.',
    duration: 'Não aplicável enquanto não estiverem instalados.',
    status: 'Não instalado',
  },
];
