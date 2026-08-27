# Painel administrativo de imóveis — design aprovado

**Data:** 27 de agosto de 2026  
**Status:** aprovado

## Objetivo

Criar um painel simples para uma única conta administradora, capaz de cadastrar, editar, revisar, publicar, inativar e reativar os imóveis exibidos no site da Imobiliária Clementino.

O PostgreSQL será a fonte oficial do catálogo. O painel publicará automaticamente uma nova versão estática do site, preservando desempenho, SEO, URLs existentes e a identidade imutável de cada imóvel. O administrador não precisará executar comandos na VPS após cadastrar ou alterar um imóvel.

## Decisões confirmadas

- uma conta administradora;
- PostgreSQL e fotos armazenados na própria VPS;
- persistência independente nos ambientes local e de produção;
- estados `rascunho`, `publicado` e `inativo`;
- publicação explícita, automática e atômica;
- localização pública aproximada por padrão;
- somente fotos na primeira versão;
- migração integral dos 53 imóveis atuais;
- links do Imovelweb não serão migrados, exibidos nem expostos pela API;
- administração disponível em `admin.clementinoimoveis.com.br`;
- Traefik mantido em seu compose isolado.

## Arquitetura

O ambiente terá quatro serviços principais:

1. **PostgreSQL:** imóveis, administrador, revisões e publicações.
2. **Admin/API:** autenticação, cadastro, edição, fotos, validação e comandos de publicação.
3. **Publicador:** geração do catálogo, páginas prerenderizadas, sitemap, metadados e artefatos estáticos.
4. **Website/Nginx:** entrega da versão publicada do site público.

Volumes persistentes:

- `postgres_data`: dados do PostgreSQL;
- `property_media`: fotos originais e derivadas;
- `published_site`: versões prontas do site público.

Fluxo:

```text
Painel → PostgreSQL → validação → geração completa → testes
       → nova versão estática → troca atômica → site atualizado
```

O publicador grava cada versão em uma área isolada. O Nginx continua entregando a versão anterior durante a geração. A referência para a versão corrente só é trocada após todas as validações. Uma falha cancela a publicação sem retirar o site atual do ar.

Na VPS, o Traefik encaminhará os domínios públicos para `website` e o subdomínio administrativo para `admin-api`. PostgreSQL e armazenamento não publicarão portas na internet.

No desenvolvimento, Docker Compose reproduzirá os serviços com banco e volumes próprios. O site ficará disponível em `localhost:4174` e o painel em `localhost:4175`.

## Identidade e ciclo de vida

Cada imóvel terá:

- UUID interno do banco;
- ID público imutável;
- referência comercial editável;
- slug editorial;
- estado de publicação;
- datas de criação, atualização e publicação;
- versão publicada e revisão em edição.

Os imóveis atuais manterão IDs, referências e URLs. Novos imóveis receberão IDs públicos próprios da Clementino. Seleções editoriais, fotos, páginas e histórico usarão o ID imutável, nunca o título ou o slug como identidade.

O painel não oferecerá exclusão definitiva. Um imóvel publicado poderá ser inativado e reativado. Alterações em conteúdo publicado formarão uma nova revisão e só entrarão no site após nova publicação.

## Dados cadastrais

### Classificação

- operações: venda, aluguel, temporada e leilão, com múltipla seleção;
- tipos: apartamento, casa, comercial, rural e terreno;
- subtipos: cobertura, duplex, flat, garden, kitnet/studio, loft, padrão, quarto, triplex e opções compatíveis com os demais tipos.

### Localização privada

- CEP com preenchimento automático;
- estado, cidade e bairro;
- rua, número e complemento;
- latitude e longitude;
- ajuste manual do marcador;
- localização pública aproximada.

O endereço exato permanece no banco. Número, complemento e coordenadas exatas nunca integram a API pública. O mapa e o texto público utilizam uma posição aproximada.

### Fotos

- HEIC, TIFF, JPG/JPEG, PNG e WebP;
- até 20 MB por arquivo;
- seleção e arrastar e soltar;
- ordenação;
- escolha da capa;
- remoção e substituição;
- otimização automática em WebP;
- capa, miniaturas e textos alternativos;
- recomendação de pelo menos dez fotos.

Vídeos, plantas e tour 360 ficam fora da primeira versão.

### Dados principais

- área total e útil;
- imóvel novo ou idade em anos;
- quartos, banheiros, suítes e vagas;
- número de andares;
- posição: frente, fundos, lateral ou meio.

### Extras

- aceita FGTS;
- aceita permuta.

### Áreas comuns

- churrasqueira;
- elevador;
- academia/sala de ginástica;
- piscina;
- playground;
- salão de festas;
- acesso para pessoas com deficiência;
- área de lazer;
- área verde;
- biblioteca;
- bicicletário;
- brinquedoteca;
- campo de futebol;
- campo de golfe;
- câmeras de segurança;
- espaço gourmet;
- estacionamento para visitantes;
- frente para o mar;
- guarita;
- lavanderia;
- portaria 24 horas;
- próximo ao metrô;
- quadra de tênis;
- quadra poliesportiva;
- salão de jogos;
- sauna;
- sistema de alarme;
- solarium;
- SPA;
- vestiário;
- vigilância 24 horas.

### Área privativa

- ar-condicionado;
- área de serviço;
- churrasqueira;
- piscina;
- playground;
- varanda;
- aquecedor;
- aquecimento central;
- biblioteca;
- closet;
- cozinha americana;
- cozinha gourmet;
- cozinha independente;
- dependência de empregados;
- despensa;
- entrada de serviço;
- escritório;
- espaço gourmet;
- freezer;
- geladeira;
- hidromassagem;
- internet sem fio;
- lareira;
- lava-louças;
- lavanderia;
- mezanino;
- micro-ondas;
- mobiliado;
- permite animais;
- roupa de cama;
- sala de jantar;
- sistema de alarme;
- suítes;
- telefone;
- TV.

### Conteúdo comercial e editorial

- título padronizado e editável;
- descrição completa com validação de qualidade;
- preço por operação;
- condomínio mensal;
- IPTU;
- referência comercial;
- destaque ou exibição comum na home;
- pré-visualização fiel da página pública;
- metadados SEO gerados automaticamente e ajustáveis;
- dados estruturados e texto alternativo das imagens.

Planos comerciais, produtos contratados, desempenho e métricas do Imovelweb não fazem parte do painel.

## Interface

### Tela inicial

- totais de publicados, rascunhos e inativos;
- últimos imóveis alterados;
- estado da última publicação;
- botão `Cadastrar imóvel`.

### Lista de imóveis

- busca por título, referência, ID, bairro, rua ou cidade;
- filtros por estado, operação, tipo e localização;
- foto de capa, preço, finalidade e data de atualização;
- visualizar, editar, publicar, inativar e duplicar como rascunho.

### Assistente de cadastro

1. classificação e operação;
2. localização privada e mapa;
3. fotos;
4. áreas, idade e cômodos;
5. características;
6. título, descrição e valores;
7. SEO, destaque e revisão final.

Cada etapa salva automaticamente como rascunho.

### Revisão

A tela de revisão mostrará blocos editáveis, percentual de preenchimento, avisos, prévia desktop/mobile, campos ausentes, qualidade das fotos, validação editorial e localização pública. O botão de publicação só será habilitado quando os requisitos obrigatórios forem atendidos.

## Segurança

- senha com hash Argon2id;
- cookie de sessão `HttpOnly`, `Secure` e `SameSite=Strict`;
- proteção CSRF;
- limite de tentativas e bloqueio temporário;
- expiração e revogação de sessões;
- troca obrigatória da senha inicial;
- redefinição por comando seguro na VPS;
- segredos fora do Git;
- bancos, volumes e credenciais separados entre desenvolvimento e produção;
- fotos originais sem acesso público direto.

## Persistência e backup

- backup diário comprimido do PostgreSQL;
- backup incremental das fotos;
- retenção de sete cópias diárias e quatro semanais;
- verificação de integridade;
- procedimento documentado e testado de restauração;
- volumes preservados por `docker compose down`;
- documentação destacando como destrutivos os comandos que removam volumes.

## Migração dos 53 imóveis

A migração deverá:

- preservar IDs, referências, finalidades, preços, endereços privados, descrições, características e ordem das fotos;
- importar os registros como publicados;
- aplicar localização pública aproximada;
- copiar as fotos para o volume persistente;
- excluir URLs e vínculos do Imovelweb;
- gerar relatório comparativo por imóvel;
- interromper diante de perda, duplicidade ou divergência comercial;
- manter os arquivos atuais intactos até a validação completa.

## Testes e critérios de lançamento

- testes unitários do domínio, valores, slugs, SEO e regras editoriais;
- integração com PostgreSQL e armazenamento;
- autenticação, sessão, bloqueio e redefinição de senha;
- criar, editar, publicar, inativar e reativar;
- falhas de publicação e rollback;
- backup e restauração reais;
- validação visual mobile e desktop;
- comparação das 53 páginas antes e depois;
- sitemap, canonical, JSON-LD, imagens e URLs anteriores;
- nenhuma divergência comercial;
- publicação automática ponta a ponta.

O painel só substituirá o fluxo atual depois que os 53 imóveis, as páginas públicas, o SEO, a responsividade, os backups e o rollback estiverem completamente validados.
