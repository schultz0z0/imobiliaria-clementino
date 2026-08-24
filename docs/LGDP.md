# Privacidade, cookies e consentimento — plano de implementação

## Status da implementação — 24 de agosto de 2026

As duas páginas legais, o banner, o painel de preferências, a persistência versionada e o bloqueio prévio de recursos opcionais foram implementados. O Google Maps depende de consentimento de funcionalidade. A infraestrutura do GA4 também está pronta, mas permanece completamente inerte enquanto `VITE_GA_MEASUREMENT_ID` não contiver um ID real e o visitante não autorizar cookies de análise.

Google Ads e Meta Pixel não estão instalados. Suas categorias continuam previstas no gerenciador para uma ativação futura controlada por consentimento e por atualização transparente desta documentação.

> Documento interno de produto e implementação. O nome do arquivo foi mantido como `LGDP.md` conforme solicitado, embora a sigla legal correta seja **LGPD**.

## 1. Objetivo

Implementar no site da Imobiliária Clementino:

1. uma página de **Aviso de Privacidade**;
2. uma página de **Política de Cookies**;
3. um gerenciador de consentimento em duas camadas;
4. links legais e acesso permanente às preferências no rodapé;
5. bloqueio real de recursos não essenciais até a escolha do visitante;
6. uma base segura para futura instalação do Google Analytics, Google Ads e Meta Pixel.

O conteúdo será original e específico para a operação da Imobiliária Clementino. Sites de terceiros poderão servir como referência de estrutura, mas seus textos não deverão ser copiados.

## 2. Dados do controlador

- **Razão social:** Claudionor Clementino Imóveis Ltda
- **Nome fantasia:** Imobiliária Clementino Ltda
- **CNPJ:** 52.656.247/0001-64
- **CRECI:** CRECI-RJ 22953
- **E-mail de privacidade:** claudionorclementinoimoveis@gmail.com
- **Telefone:** (21) 96402-3524
- **Endereço comercial:** Rua Professor França Amaral, Jardim América, Rio de Janeiro — RJ, CEP 21240-010

O endereço deve ser publicado **sem número**, conforme orientação do responsável pelo negócio.

## 3. Princípios aprovados

- O visitante não será obrigado a “aceitar a Política de Privacidade”. O aviso de privacidade terá caráter informativo e transparente.
- O consentimento será solicitado apenas para recursos e tecnologias não essenciais que dependam dessa base legal.
- Rejeitar cookies não essenciais será tão simples e visível quanto aceitá-los.
- Categorias opcionais começarão desativadas.
- O site e suas funções essenciais continuarão disponíveis após a rejeição.
- O visitante poderá alterar ou retirar sua escolha a qualquer momento pelo rodapé.
- Nenhuma tecnologia futura será apresentada como ativa antes de sua instalação efetiva.
- Não serão usados padrões manipulativos, opções pré-marcadas ou botões de rejeição escondidos.

## 4. Estado atual identificado

Na data deste documento, o projeto não possui Google Analytics, Google Ads, Meta Pixel, Hotjar ou ferramenta semelhante instalada.

Integrações externas atualmente relevantes:

- Google Maps incorporado nas páginas dos imóveis;
- links externos e contato pelo WhatsApp;
- fontes do Google carregadas remotamente.

O formulário de contato atual monta uma mensagem no navegador e encaminha o visitante ao WhatsApp. O projeto não possui um backend próprio recebendo esse formulário.

Antes da publicação da solução de consentimento:

- o Google Maps deverá ser condicionado à categoria de funcionalidade ou a uma ativação explícita do visitante;
- as fontes utilizadas deverão ser hospedadas localmente sempre que tecnicamente possível;
- links do WhatsApp continuarão disponíveis, com transparência sobre o redirecionamento a uma plataforma externa.

## 5. Gerenciador de consentimento

### 5.1 Primeira camada: banner

Na primeira visita, será exibido um banner responsivo no rodapé da tela, com:

- explicação curta e direta;
- link para a Política de Cookies;
- link para o Aviso de Privacidade;
- botão **Aceitar todos**;
- botão **Rejeitar não essenciais**;
- botão **Preferências**.

Os três caminhos deverão ter fácil visualização e navegação por teclado. O banner não deverá impedir o uso das funções essenciais do site.

### 5.2 Segunda camada: preferências

O botão **Preferências** abrirá um modal acessível contendo as categorias abaixo, com descrição, estado e exemplos.

#### Estritamente necessários

- Sempre ativos.
- Não poderão ser desligados no painel.
- Incluem o registro local da escolha de consentimento e recursos indispensáveis à navegação.

#### Funcionalidade

- Desativados por padrão.
- Incluirão o carregamento do Google Maps e eventuais recursos externos de conveniência.
- Sem autorização, o mapa será substituído por um bloco informativo com opção para ativá-lo.

#### Análise e desempenho

- Desativados por padrão.
- Reservados para a futura instalação do Google Analytics ou tecnologia equivalente.
- Não haverá script, identificador ou chamada de rede dessa categoria enquanto ela não estiver instalada e autorizada.

#### Publicidade

- Desativados por padrão.
- Reservados para Google Ads, Meta Pixel e tecnologias relacionadas a campanhas, conversões e remarketing.
- Nenhum rastreador publicitário será carregado antes do consentimento dessa categoria.

O modal oferecerá:

- **Aceitar todos**;
- **Rejeitar não essenciais**;
- **Salvar preferências**;
- fechamento seguro sem alterar uma escolha já salva.

### 5.3 Armazenamento da escolha

As preferências serão gravadas localmente no navegador em um registro versionado contendo, no mínimo:

- versão da política de consentimento;
- data e hora da escolha;
- estado de cada categoria opcional.

Uma nova solicitação de consentimento somente deverá ocorrer quando:

- não houver escolha registrada;
- o usuário limpar os dados do navegador;
- a estrutura ou versão das finalidades mudar de modo relevante.

Não será criado perfil pessoal no servidor apenas para armazenar consentimento.

## 6. Aviso de Privacidade

### Rota proposta

`/aviso-de-privacidade`

### Conteúdo mínimo

1. identificação e contato do controlador;
2. escopo do aviso;
3. quais dados podem ser tratados;
4. como os dados são obtidos;
5. finalidades e bases legais aplicáveis;
6. contato iniciado pelo visitante e uso do WhatsApp;
7. dados técnicos de navegação e registros de segurança;
8. compartilhamento com fornecedores e plataformas externas;
9. transferências internacionais eventualmente realizadas pelos fornecedores;
10. critérios de retenção e descarte;
11. medidas de segurança;
12. direitos do titular previstos na LGPD;
13. como exercer os direitos;
14. tratamento de dados de crianças e adolescentes, quando aplicável;
15. cookies e link para a política específica;
16. atualizações do aviso e data da última revisão.

O texto deverá refletir apenas práticas verdadeiras do site e da operação. Prazos de retenção que não estejam definidos não deverão ser inventados; nesses casos serão descritos critérios proporcionais à finalidade e às obrigações legais.

## 7. Política de Cookies

### Rota proposta

`/politica-de-cookies`

### Conteúdo mínimo

1. definição de cookies e tecnologias semelhantes;
2. diferença entre armazenamento próprio e serviços de terceiros;
3. categorias utilizadas pelo gerenciador;
4. lista das tecnologias efetivamente ativas;
5. provedor, finalidade e duração conhecida de cada tecnologia;
6. distinção clara entre tecnologias atuais e integrações apenas planejadas;
7. explicação de como aceitar, rejeitar, alterar ou retirar o consentimento;
8. controles disponíveis no navegador;
9. consequências funcionais da desativação;
10. atualizações da política e canal de contato.

Google Analytics, Google Ads e Meta Pixel somente entrarão na tabela de tecnologias ativas após instalação, configuração e validação técnica.

## 8. Rodapé e navegação

O rodapé de todas as páginas incluirá:

- **Aviso de Privacidade**;
- **Política de Cookies**;
- **Preferências de cookies**.

O último item será um botão, não apenas um texto informativo, e reabrirá o painel de preferências sem exigir limpeza manual do navegador.

As páginas legais usarão o mesmo cabeçalho, rodapé, tipografia, cores e identidade visual do restante do site.

## 9. Arquitetura técnica proposta

A implementação deverá separar responsabilidades:

- módulo de tipos, versão e persistência das preferências;
- provedor de consentimento para disponibilizar o estado à aplicação;
- banner de primeira camada;
- modal de preferências;
- bloqueio ou liberação de integrações por categoria;
- páginas legais;
- acionador no rodapé.

Recursos futuros deverão consumir o estado central do consentimento. Não será permitido espalhar verificações independentes ou injetar scripts diretamente nas páginas.

O carregamento de scripts externos deverá ocorrer somente após a autorização correspondente. A retirada do consentimento deverá impedir novos eventos e, quando tecnicamente necessário, remover ou invalidar integrações já carregadas, observadas as limitações do fornecedor.

## 10. Experiência visual e acessibilidade

- Visual escuro e dourado coerente com o KV da Imobiliária Clementino.
- Banner compacto no desktop e reorganizado para telas móveis.
- Modal central no desktop e apresentação adaptada no mobile.
- Foco inicial controlado, contenção de foco e retorno ao elemento acionador.
- Fechamento por `Escape` quando não houver risco de perder uma escolha nova.
- Rótulos acessíveis nos controles e estados que não dependam somente de cor.
- Áreas de toque adequadas e contraste legível.
- Respeito a preferências de movimento reduzido.

## 11. Testes obrigatórios

### Unidade e integração

- ausência de escolha exibe o banner;
- configurações opcionais começam desativadas;
- aceitar todos habilita todas as categorias opcionais;
- rejeitar mantém apenas os recursos necessários;
- salvar preferências preserva escolhas individuais;
- atualização de versão invalida uma escolha antiga;
- registro inválido não quebra a aplicação;
- botão do rodapé reabre as preferências;
- Google Maps não carrega sem autorização funcional;
- Google Maps carrega após autorização;
- futuras integrações de análise e publicidade possuem pontos de bloqueio testáveis;
- rotas legais e links do rodapé funcionam.

### Validação no navegador

- teclado, foco e leitor de tela;
- desktop e mobile;
- rejeição, aceitação e retirada posterior;
- nenhuma chamada ao Google Maps antes da permissão funcional;
- nenhum rastreador de análise ou publicidade presente antes da instalação e do consentimento;
- persistência após recarregar a página;
- build de produção sem erros.

## 12. Critérios de aceite

A implementação estará pronta para validação quando:

- as duas páginas legais estiverem acessíveis e coerentes com as práticas reais;
- o banner oferecer aceitar, rejeitar e personalizar sem tratamento desigual enganoso;
- categorias opcionais iniciarem desligadas;
- o mapa estiver realmente bloqueado antes da autorização;
- o rodapé permitir revisar a escolha;
- o site essencial funcionar após rejeição;
- não houver Google Analytics, Google Ads ou Meta Pixel instalado prematuramente;
- testes automatizados e build passarem;
- o comportamento for validado localmente antes de qualquer commit ou push.

## 13. Referências

- [Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [Guia orientativo da ANPD — Cookies e proteção de dados pessoais](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/%40%40display-file/file)

## 14. Observação jurídica

Este documento orienta produto, conteúdo e implementação técnica. Ele não substitui revisão jurídica profissional. Antes da publicação definitiva, recomenda-se validar especialmente as práticas internas que não podem ser inferidas pelo código do site, como retenção de contatos, atendimento pelo WhatsApp, compartilhamento operacional e obrigações documentais da imobiliária.
