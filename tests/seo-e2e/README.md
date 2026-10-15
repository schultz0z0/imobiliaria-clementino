# Teste real de cadastro e SEO automático

O teste usa painel, API, banco descartável e worker reais. Nunca aponte para a VPS.

1. Compile o site com `npm run build`.
2. Crie PostgreSQL descartável em porta local não padrão, com banco chamado
   `clementino_seo_e2e_test`. Não use o volume PostgreSQL do desenvolvimento normal.
3. Defina `SEO_E2E_DATABASE_URL` para esse banco e `CLEMENTINO_ISOLATED_SEO_E2E=1`.
4. Execute `npx tsx tests/seo-e2e/environment.ts`. Ele cria um administrador de
   teste e usa mídia/releases sob `node_modules/.cache/clementino-seo-e2e`.
5. Sirva o build `dist/` via Nginx em `127.0.0.1:4184`, com `nginx.conf` deste
   projeto, resolvendo `public-seo:3000` para o backend local da porta 4187. Para
   esse ambiente isolado, encaminhe também `/api/public/` para o mesmo backend.
   Na implantação real, as rotas de catálogo/mídia continuam na API da VPS.
6. Em outro terminal com `CLEMENTINO_ISOLATED_SEO_E2E=1`, execute
   `npx playwright test -c playwright.seo.config.ts`.

O primeiro login troca a senha temporária. Ao repetir no mesmo banco, defina
`SEO_E2E_PASSWORD=SeoTest!Changed123`; credenciais são apenas do usuário fictício.
O teste deixa o anúncio inativo depois de verificar cadastro, upload, publicação,
SEO sem JavaScript, sitemap, llms, imagem, atualização de preço e retirada.
Screenshots ficam em `test-results/`. Remova apenas os containers e volumes
descartáveis criados para esse teste ao terminar.
