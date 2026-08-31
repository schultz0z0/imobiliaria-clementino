# Mapa de localização gratuito — Plano de implementação

> **Para o agente:** executar este plano com TDD e validação antes de declarar a tarefa concluída.

**Objetivo:** preencher coordenadas a partir do endereço do imóvel e exibir um mapa funcional no painel sem depender de uma chave do Google.

**Arquitetura:** ViaCEP continua sendo a fonte de endereço por CEP. O servidor consulta o Nominatim/OpenStreetMap com requisição identificada, limite de tempo e cache em memória por endereço; a resposta fica disponível apenas para o painel autenticado. O navegador usa Leaflet com tiles OpenStreetMap, mostra o marcador aproximado e permite arrastar o marcador público sem expor número, complemento ou coordenadas exatas na API pública.

**Tecnologias:** Fastify, Zod, React, Leaflet, OpenStreetMap/Nominatim, Node test runner.

---

### Tarefa 1: Geocodificação server-side e contrato do cliente

**Arquivos:**
- Modificar: `server/api/locationRoutes.ts`
- Modificar: `admin/src/api/client.ts`
- Testar: `server/api/locationRoutes.test.ts`, `admin/src/editor/api.test.ts`

**Passos:**
1. Escrever testes que falhem para endereço válido retornando latitude/longitude, timeout/erro retornando fallback manual e cache evitando segunda consulta.
2. Executar os testes e confirmar RED.
3. Implementar adaptador Nominatim configurável por `NOMINATIM_ENDPOINT`, com `User-Agent` identificável, timeout, limite de resposta, validação Zod e cache por endereço normalizado.
4. Adicionar `geocodeLocation` ao contrato e ao cliente HTTP, sem incluir dados no endpoint público.
5. Executar os testes focados e confirmar GREEN.

### Tarefa 2: Mapa Leaflet responsivo no editor

**Arquivos:**
- Modificar: `package.json`, `package-lock.json`
- Modificar: `admin/src/components/location/LocationEditor.tsx`
- Modificar: `admin/src/editor/steps/LocationStep.tsx`
- Modificar: `admin/src/styles.css`
- Testar: `admin/src/components/location/LocationEditor.test.tsx`

**Passos:**
1. Escrever teste para renderizar o contêiner do mapa quando houver coordenadas, mostrar atribuição OpenStreetMap e manter o fallback quando não houver geocodificação.
2. Executar o teste e confirmar RED.
3. Adicionar Leaflet e inicializar/destruir o mapa com segurança em efeitos React; usar marcador arrastável apenas para coordenada pública; informar falhas e permitir confirmação manual.
4. Após o preenchimento do ViaCEP, disparar geocodificação do endereço e atualizar coordenadas privadas; gerar a prévia pública pelo endpoint de privacidade existente.
5. Corrigir strings acentuadas dos textos tocados e manter layout mobile/desktop sem overflow.
6. Executar testes de localização e build do admin; confirmar GREEN.

### Tarefa 3: Verificação final

1. Executar testes unitários/integrados de localização, `npm run admin:build`, `npm run server:build` e `npm run build`.
2. Confirmar que não há chave/URL do Google, que a atribuição OSM aparece e que `content/manual/` e arquivos não relacionados permanecem intocados.
3. Registrar limitações do Nominatim público na documentação de deploy, sem expor credenciais.
