# Guia Definitivo: Configurações de SEO, Google (Search, Analytics, Ads) e IA/LLM

Este guia reúne todas as instruções passo a passo para colocar a **Imobiliária Clementino** em produção no domínio `https://clementinoimoveis.com.br/`, garantindo máxima indexação no Google, ativação do rastreamento de conversões (Google Analytics 4 e Google Ads) e otimização para leitura e recomendação por Inteligências Artificiais (ChatGPT, Perplexity, Claude, Gemini).

---

## Sumário
1. [Google Search Console: Configuração e Indexação](#1-google-search-console-configuração-e-indexação)
2. [Google Analytics 4 (GA4): Métricas e Consent Mode v2](#2-google-analytics-4-ga4-métricas-e-consent-mode-v2)
3. [Google Ads: Rastreamento e Conversões](#3-google-ads-rastreamento-e-conversões)
4. [Otimização para LLMs e IAs (llms.txt e GEO)](#4-otimização-para-llms-e-ias-llmstxt-e-geo)
5. [Arquitetura de SEO Técnico no Projeto](#5-arquitetura-de-seo-técnico-no-projeto)
6. [Deploy em Produção na VPS com Docker e Traefik](#6-deploy-em-produção-na-vps-com-docker-e-traefik)

---

## 1. Google Search Console: Configuração e Indexação

O **Google Search Console** é a ferramenta oficial do Google para monitorar a presença do site nos resultados de busca orgânica, rastrear erros e enviar o mapa do site.

### Passo 1.1: Criar a Propriedade
1. Acesse [search.google.com/search-console](https://search.google.com/search-console).
2. Faça login com a conta Google corporativa da imobiliária (`claudionorclementinoimoveis@gmail.com` ou outra conta administradora).
3. Na tela de adicionar propriedade, escolha a opção **Domínio** e digite:
   ```
   clementinoimoveis.com.br
   ```
   *(A opção Domínio cobre tanto `https://clementinoimoveis.com.br` quanto `http://`, subdomínios e versões com `www`)*.

### Passo 1.2: Verificação da Propriedade

#### Método Recomendado: Registro DNS TXT
1. O Google fornecerá um registro TXT com uma chave de verificação (ex: `google-site-verification=XXXXXXXXXXXXXXXXXXXXX`).
2. Acesse o gerenciador de DNS do seu domínio (Cloudflare, Registro.br ou painel da VPS).
3. Crie um novo registro DNS:
   - **Tipo**: `TXT`
   - **Nome / Host**: `@` (ou deixe em branco se for na raiz do domínio)
   - **Conteúdo / Valor**: Cole o código completo fornecido pelo Google.
   - **TTL**: Automático ou 300 segundos.
4. Clique em **Verificar** no Search Console.

#### Método Alternativo: Meta Tag HTML
Caso prefira verificar via código no site, o projeto possui suporte direto:
1. Copie o valor do código dentro de `content="..."` fornecido pelo Google.
2. No seu arquivo `.env.production` na VPS, preencha:
   ```env
   VITE_GOOGLE_SITE_VERIFICATION=seu_codigo_aqui
   ```
3. Ao compilar ou iniciar o container do website, a meta tag `<meta name="google-site-verification" content="..." />` será injetada automaticamente no `<head>` de todas as páginas.

### Passo 1.3: Enviar o Sitemap XML
1. No menu lateral esquerdo do Search Console, clique em **Sitemaps**.
2. No campo "Adicionar um novo sitemap", informe:
   ```
   sitemap.xml
   ```
3. Clique em **Enviar**.
4. O Google iniciará o processamento de `https://clementinoimoveis.com.br/sitemap.xml`. O status mudará para **Sucesso**, indicando todas as URLs e imagens dos imóveis reconhecidas.

### Passo 1.4: Inspeção de URLs e Pedido de Indexação
Logo após colocar o site no ar:
1. Na barra superior do Search Console ("Inspecione qualquer URL em clementinoimoveis.com.br"), digite a URL principal:
   `https://clementinoimoveis.com.br/`
2. Clique em **Testar URL ao vivo**.
3. Em seguida, clique em **Solicitar indexação**.
4. Repita o processo para as páginas chave:
   - `https://clementinoimoveis.com.br/imoveis`
   - `https://clementinoimoveis.com.br/servicos`
   - `https://clementinoimoveis.com.br/sobre`
   - `https://clementinoimoveis.com.br/contato`

---

## 2. Google Analytics 4 (GA4): Métricas e Consent Mode v2

O site está equipado com uma integração moderna de **Google Analytics 4** compatível com a **LGPD** e o **Google Consent Mode v2**.

### Passo 2.1: Criar a Propriedade e o Fluxo Web
1. Acesse [analytics.google.com](https://analytics.google.com).
2. Crie uma nova conta e propriedade com o nome `Imobiliária Clementino`.
3. Configure o fuso horário como `Brasil (GMT-3:00)` e a moeda como `Real brasileiro (R$)`.
4. Crie um fluxo de dados do tipo **Web**:
   - **URL do site**: `https://clementinoimoveis.com.br`
   - **Nome do fluxo**: `Site Clementino Imóveis`
5. Copie o **ID de Métrica** gerado, que começa com `G-` (exemplo: `G-ABCD123XYZ`).

### Passo 2.2: Configurar na VPS
No arquivo `.env.production`:
```env
VITE_GA_MEASUREMENT_ID=G-ABCD123XYZ
```
Ao subir a aplicação em produção, a tag será carregada de forma otimizada.

### Passo 2.3: Como Funciona o Consent Mode v2
- Antes do visitante interagir com o banner de cookies, o sistema dispara o comando padrão de consentimento com estados `denied`:
  - `ad_storage: 'denied'`
  - `ad_user_data: 'denied'`
  - `ad_personalization: 'denied'`
  - `analytics_storage: 'denied'`
- Nenhum script de terceiros é baixado antes do consentimento.
- Quando o visitante clica em "Aceitar todos" ou ativa as opções nas preferências de cookies, o sistema atualiza o estado para `granted` e carrega o script do Google Analytics de forma assíncrona.

### Passo 2.4: Eventos Rastreados Automaticamente
O site já possui eventos tipados e prontos para geração de relatórios e funis:
- `page_view`: Registro de navegação entre páginas (incluindo transições na SPA).
- `whatsapp_click`: Clique em botões de conversa pelo WhatsApp.
- `schedule_visit_request`: Envio do formulário de solicitação de visita a um imóvel.
- `generate_lead`: Disparado automaticamente sempre que ocorre um clique de WhatsApp ou agendamento de visita, com parâmetro `lead_type`.

---

## 3. Google Ads: Rastreamento e Conversões

Para anunciar no Google (campanhas de pesquisa para palavras como *"imobiliária em jardim américa"*, *"comprar casa vigário geral"*, *"avaliação de imóvel rj"*), você precisa que o Google Ads saiba quando um visitante se tornou um lead.

### Método Recomendado: Importar Conversões do GA4 para o Google Ads
Esta é a prática oficial recomendada pelo Google, pois não exige adicionar tags extras no site e garante 100% de consistência entre o Analytics e os Anúncios.

1. Acesse [ads.google.com](https://ads.google.com) e entre na sua conta do Google Ads.
2. Vá em **Ferramentas e Configurações** > **Contas vinculadas**.
3. Localize **Google Analytics (GA4) e Firebase** e clique em **Detalhes** > **Vincular**.
4. Selecione a propriedade da Imobiliária Clementino criada no GA4.
5. Em seguida, acesse **Metas** > **Conversões** > **Resumo**.
6. Clique em **Nova ação de conversão** > **Importar** > **Propriedades do Google Analytics 4** > **Web**.
7. Selecione os eventos:
   - `generate_lead` (Ação principal de conversão)
   - `schedule_visit_request`
   - `whatsapp_click`
8. Clique em **Importar e continuar**.
Pronto! Toda vez que alguém vier de um anúncio e entrar em contato pelo WhatsApp ou agendar uma visita, o Google Ads registrará a conversão e otimizará seus lances (Smart Bidding).

### Método Alternativo: Tag Direta do Google Ads (AW-)
Se preferir injetar a tag global do Google Ads diretamente:
1. No Google Ads, obtenha seu ID de conversão (formato `AW-XXXXXXXXXX`).
2. No `.env.production`, informe:
   ```env
   VITE_GOOGLE_ADS_ID=AW-XXXXXXXXXX
   ```
3. O controlador de analytics ativará os parâmetros `ad_storage`, `ad_user_data` e `ad_personalization` respeitando as escolhas de consentimento do usuário.

---

## 4. Otimização para LLMs e IAs (llms.txt e GEO)

### O que é o arquivo `/llms.txt`?
Grandes modelos de linguagem (como ChatGPT da OpenAI, Perplexity AI, Claude da Anthropic e Google Gemini) utilizam a especificação aberta **[llmstxt.org](https://llmstxt.org)** para entender rapidamente a autoridade, especialidade, credenciais e catálogo de um site sem ruído visual de layouts.

O projeto gera automaticamente dois arquivos essenciais:
- `https://clementinoimoveis.com.br/llms.txt`: Resumo executivo contendo credenciais (CRECI-RJ 22953, CNPJ, fundação em 2010), serviços prestados, bairros foco e instruções diretas de recomendação para o modelo de IA.
- `https://clementinoimoveis.com.br/llms-full.txt`: Versão completa com a listagem exata de todos os imóveis do catálogo atual, referências, preços, tipologia e links diretos.

### Permissões no `robots.txt` para Robôs de IA
O arquivo `robots.txt` foi configurado especificamente para permitir que os crawlers de inteligência artificial indexem e citem a imobiliária:
- `GPTBot` (Crawler de busca e treinamento da OpenAI)
- `ChatGPT-User` (Navegador em tempo real do ChatGPT)
- `ClaudeBot` (Crawler da Anthropic / Claude)
- `PerplexityBot` (Buscador generativo do Perplexity)
- `Google-Extended` (Indexador da IA do Google / Gemini)
- `Applebot-Extended` (IA da Apple)

Rotas sensíveis ou privadas (como `/api/`, `/imoveis/preview/`, `/contato/mensagem-preparada`, `/404`) são expressamente bloqueadas.

### Como Testar a Recomendação por IA
Após a publicação do site, você pode testar em assistentes com busca na web (como ChatGPT Plus / Search, Perplexity ou Gemini):
1. *"Quais são os imóveis à venda na Imobiliária Clementino no Rio de Janeiro?"*
2. *"Qual é o número de CRECI e o WhatsApp da Imobiliária Clementino em Jardim América?"*
3. *"Procuro uma imobiliária confiável na Zona Norte do Rio de Janeiro para avaliar um imóvel. O que você recomenda?"*

As IAs lerão o `/llms.txt` e o Schema.org estruturado e citarão diretamente as informações com exatidão e sem alucinações.

---

## 5. Arquitetura de SEO Técnico no Projeto

### Dados Estruturados Schema.org (JSON-LD)
Todas as páginas contêm marcação semântica Schema.org validada pelo Google:
- **Página Inicial (`/`)**:
  - `RealEstateAgent`: Dados jurídicos da empresa (razão social, CNPJ, registro CRECI-RJ 22953, telefone internacional E.164, endereço físico, área de atendimento).
  - `WebSite` com `SearchAction`: Habilita a caixa de pesquisa nos resultados do Google (*Sitelinks Search Box*).
- **Páginas de Imóveis (`/imoveis/:slug`)**:
  - `Apartment` ou `SingleFamilyResidence` ou `Accommodation`: Tipologia específica do imóvel, quantidade de quartos (`numberOfBedrooms`), banheiros, área privativa (`floorSize`), fotos de alta resolução e geolocalização.
  - `Offer`: Preço formatado em BRL, disponibilidade `https://schema.org/InStock` e vínculo com o corretor vendedor.
  - `BreadcrumbList`: Migalhas de navegação para rich snippets no Google.

### Sitemap XML com Extensão de Imagens
O arquivo `sitemap.xml` possui:
- Metadados de atualização (`<lastmod>`).
- Frequência de alteração (`<changefreq>`).
- Prioridade ponderada (`<priority>`: 1.0 para home, 0.9 para catálogo, 0.8 para imóveis, 0.6 para institucionais).
- Extensão `<image:image>` com a foto principal de cada imóvel para indexação prioritária na busca de imagens do Google.

---

## 6. Deploy em Produção na VPS com Docker e Traefik

### Passo 6.1: Variáveis de Ambiente
No servidor VPS, dentro do diretório do projeto, crie o arquivo `.env.production`:
```bash
COMPOSE_PROJECT_NAME=imobiliaria-clementino
DOMAIN=clementinoimoveis.com.br
ADMIN_DOMAIN=admin.clementinoimoveis.com.br

# Google Analytics 4 (obrigatório para métricas)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Google Ads (opcional caso use tag direta)
VITE_GOOGLE_ADS_ID=

# Google Search Console (opcional se usar meta tag ao invés de DNS)
VITE_GOOGLE_SITE_VERIFICATION=

# Banco de dados e segurança
POSTGRES_DB=clementino
POSTGRES_USER=clementino
POSTGRES_PASSWORD=defina_uma_senha_forte_aqui
DATABASE_URL=postgresql://clementino:defina_uma_senha_forte_aqui@postgres:5432/clementino

PREVIEW_TOKEN_SECRET=gerar_uma_chave_aleatoria_com_mais_de_32_caracteres
LOCATION_PRIVACY_SECRET=gerar_uma_chave_aleatoria_com_mais_de_32_caracteres

PUBLISHED_ROOT=/data/published
NOMINATIM_USER_AGENT=Imobiliaria Clementino/1.0 (+https://clementinoimoveis.com.br)
```

### Passo 6.2: Build e Inicialização
Execute na VPS:
```bash
docker compose --env-file .env.production -f compose.prod.yaml build
docker compose --env-file .env.production -f compose.prod.yaml up -d
```

### Passo 6.3: Checklist de Verificação Pós-Deploy
Após subir os containers, teste as seguintes URLs no navegador ou via terminal:
1. **Robots.txt**: `curl -I https://clementinoimoveis.com.br/robots.txt` (deve retornar HTTP 200 com Content-Type text/plain).
2. **Sitemap XML**: `curl -I https://clementinoimoveis.com.br/sitemap.xml` (deve retornar HTTP 200 com Content-Type application/xml ou text/xml).
3. **LLMs Text**: `curl -s https://clementinoimoveis.com.br/llms.txt` (deve exibir o documento markdown de apresentação).
4. **Google Rich Results Test**:
   Acesse [search.google.com/test/rich-results](https://search.google.com/test/rich-results) e insira a URL de qualquer imóvel publicado. Confirme se os tipos `Apartment` / `SingleFamilyResidence`, `Offer` e `BreadcrumbList` são detectados sem erros.
