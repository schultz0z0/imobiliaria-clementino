# Design do patch de lançamento e SEO

Data: 24 de agosto de 2026

## Objetivo

Resolver as pendências técnicas do checkup final sem alterar a identidade visual aprovada, sem incluir prova social e sem publicar mudanças. O resultado deve ser validável localmente e deixar o site pronto para receber o Measurement ID do GA4 por configuração.

## Escopo aprovado

- página 404 personalizada e não indexável;
- breadcrumbs curtos nas páginas internas;
- CTA global de WhatsApp no mobile, sem duplicação na página individual do imóvel;
- estado final “Mensagem preparada” após o formulário de contato;
- promessa operacional “Retorno em até 1 dia útil”;
- `robots.txt`, sitemap automático e páginas HTML com metadados por rota;
- canonical, Open Graph, Twitter Cards e imagem social real;
- JSON-LD `RealEstateAgent` apenas com dados verificados;
- mapa institucional condicionado ao consentimento de funcionalidade;
- GA4 e Consent Mode preparados por variável de ambiente, inativos sem um ID `G-...`;
- eventos de navegação e conversão sem carregar Analytics antes do consentimento;
- divisão do bundle por rota;
- testes automatizados, lint, build e validação visual mobile/desktop.

Ficam fora do escopo: estudo de caso, FAQ, avaliações, foto de equipe, GTM, Meta Pixel, publicação, commit e push.

## Arquitetura

O catálogo continuará sendo a fonte única dos imóveis. Um gerador SEO puro produzirá `robots.txt`, `sitemap.xml` e, depois do build do Vite, documentos HTML por rota com `<title>`, canonical, Open Graph e Twitter Card já presentes na resposta inicial. Isso evita depender da execução de JavaScript por robôs de busca e compartilhadores sociais. O React também atualizará os mesmos metadados durante a navegação SPA.

Os dados estruturados do negócio serão renderizados globalmente como `RealEstateAgent`, usando somente razão social, nome fantasia, CNPJ, CRECI, telefone, e-mail, URL e endereço já confirmados. Breadcrumbs visuais e `BreadcrumbList` compartilharão a mesma configuração por página.

O Analytics será um módulo carregado sob demanda. O Consent Mode começará negado para armazenamento de análise e publicidade; a Google tag só será baixada quando houver ID válido e consentimento para análise. Alterações posteriores nas preferências atualizarão os sinais. Eventos serão emitidos por uma camada pequena e testável.

## Experiência e conversão

O CTA móvel global aparecerá nas rotas comerciais e ficará ausente na página individual, que já possui sua barra própria, e nas páginas legais/404. O formulário continuará preparando a mensagem localmente e abrindo o WhatsApp; em seguida navegará para uma página honesta que informa que a mensagem ainda precisa ser enviada. A promessa de retorno em até um dia útil aparecerá nos pontos de contato.

O mapa do endereço comercial reutilizará o padrão de consentimento já existente no mapa dos imóveis. O endereço continuará sem número, conforme instrução do responsável.

## SEO e indexação

O sitemap conterá as páginas comerciais e todos os imóveis válidos, sem páginas de confirmação, 404 ou rotas técnicas. `robots.txt` permitirá o rastreamento público e apontará para o sitemap absoluto. A home terá imagem social institucional real; imóveis usarão sua foto principal. A 404 e a confirmação de contato usarão `noindex, nofollow`.

## Desempenho e erros

As páginas secundárias serão carregadas com `React.lazy`, mantendo a home como entrada principal. Falhas de rota serão absorvidas pela 404. Ausência ou formato inválido do Measurement ID manterá o Analytics totalmente inativo, sem quebrar o site.

## Validação

Cada comportamento novo será precedido por teste falhando. Ao final serão executados todos os testes, TypeScript, build, verificação do catálogo, checagem do diff e smoke test nas rotas críticas em mobile e desktop. Nenhum commit ou push será realizado.
