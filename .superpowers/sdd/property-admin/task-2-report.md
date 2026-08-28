# Task 2 — Schema canônico de imóvel e catálogo de características

## Resultado

- Criado um contrato canônico estrito em Zod para classificação, endereço privado, localização pública aproximada, fatos, características, editorial, preços, mídia e SEO.
- `PropertyDraft`, `PublishableProperty`, `PublicPropertyDto` e `PublicPropertyDTO` são inferidos dos schemas Zod; não há interface manual duplicando o imóvel.
- O DTO público é montado do `shape` canônico sem `privateAddress`, portanto rua, CEP, número, complemento e coordenadas privadas não fazem parte de seu tipo ou schema.
- Os catálogos de tipos, subtipos, 31 áreas comuns e 35 áreas privativas têm IDs estáveis, labels pt-BR, ordem determinística e congelamento da lista e de cada item.
- Não foi implementado banco de dados, UI, integração externa nem campo de link.

## RED/GREEN

1. RED inicial: `rtk node --import tsx --test shared/propertySchema.test.ts shared/featureCatalog.test.ts` — 0 aprovados, 2 falhas esperadas (`ERR_MODULE_NOT_FOUND` para os módulos ainda ausentes).
2. GREEN inicial: o mesmo comando passou com 15/15 após a implementação mínima.
3. RED de limite público: novo teste demonstrou que `publicPropertySchema` aceitava uma URL do domínio Imovelweb — 15 aprovados, 1 falha esperada.
4. GREEN de limite público: refinamento recursivo compartilhado passou a rejeitar a URL no schema canônico e no contrato público — 16/16.
5. RED de privacidade geográfica: novo teste demonstrou que coordenadas públicas idênticas às privadas eram aceitas — 16 aprovados, 1 falha esperada.
6. GREEN de privacidade geográfica: o schema passou a exigir que a posição pública não reproduza o par exato privado — 17/17.
7. Durante o refactor de encapsulamento, a tentativa de usar `.omit()` em schema refinado falhou em runtime no Zod 4; a suíte capturou a regressão. O DTO passou a derivar de `propertyDraftSchema.shape`, e o GREEN final voltou a 17/17.

## Regras cobertas

- Uma ou mais operações entre venda, aluguel, temporada e leilão; operações sem duplicidade e preço correspondente obrigatório.
- Tipos e subtipos limitados aos catálogos aprovados.
- Objetos estritos, IDs de características aprovados e sem duplicidade.
- Endereço privado separado de localização pública com `precision: 'approximate'`; par público idêntico ao privado é rejeitado.
- Áreas positivas; contadores inteiros não negativos; suítes não excedem quartos; área útil não excede área total; imóvel novo não aceita idade.
- Flags de FGTS/permuta, conteúdo editorial com limites de qualidade, referência, destaque, preços, condomínio e IPTU não negativos.
- Fotos ordenadas únicas, capa obrigatória quando há fotos e pertencente à galeria; imagem de SEO também deve pertencer à galeria.
- Chaves desconhecidas são rejeitadas; chaves contendo `imovelweb` e strings com domínio Imovelweb recebem rejeição explícita e recursiva.

## Verificação final

- `rtk node --import tsx --test shared/propertySchema.test.ts shared/featureCatalog.test.ts` — 17 aprovados, 0 falhas.
- `rtk npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --esModuleInterop shared/featureCatalog.ts shared/propertySchema.ts shared/apiContract.ts shared/featureCatalog.test.ts shared/propertySchema.test.ts` — sem erros.
- `rtk npm test` — 141 aprovados, 0 falhas.
- `rtk npm run server:build` — sucesso; bundle ESM Node 22 gerado.
- `rtk npm run admin:build` — sucesso; 28 módulos transformados.
- Os diretórios gerados `dist-server` e `dist-admin` foram conferidos e removidos após os builds.

## Arquivos da tarefa

- `shared/propertySchema.ts`
- `shared/propertySchema.test.ts`
- `shared/featureCatalog.ts`
- `shared/featureCatalog.test.ts`
- `shared/apiContract.ts`
- `.superpowers/sdd/property-admin/task-2-report.md`

## Auto-revisão e preocupações

- `npm test` atualmente procura apenas `src/**/*.test.ts` e `scripts/**/*.test.ts`; por isso os testes em `shared/` exigem o comando focado explícito, executado separadamente antes do commit.
- O schema impede que a localização pública repita exatamente as coordenadas privadas e o DTO omite o bloco privado. A estratégia que produzirá o deslocamento geográfico aproximado será responsabilidade da camada de cadastro/publicação futura.
- `publishablePropertySchema` compartilha as regras completas do draft porque este escopo não definiu exigências adicionais exclusivas da publicação (por exemplo, quantidade mínima de fotos).
- A revisão confirmou que nenhum arquivo em `content/manual/`, DB ou UI foi alterado.

## Fix round — revisão bloqueante

- Privacidade: `publicLocation.label` é reconstruído pelo DTO a partir de bairro, cidade e UF; o schema canônico rejeita rótulos que divergem desses campos ou contêm rua, número ou complemento, exige `precision: 'approximate'`, exige pares completos de coordenadas e rejeita posições públicas exatas ou quase exatas.
- Contrato público: `publicPropertySchema` deriva o shape sem `privateAddress` e reaplica todos os refinamentos cruzados (operações/preços, novo/idade, áreas, suítes/quartos, duplicidades, mídia/capa, SEO e rejeição de Imovelweb).
- Catálogo: `PROPERTY_SUBTYPES_BY_TYPE` é uma matriz imutável com as combinações aprovadas; a validação agora rejeita subtipo incompatível tanto no draft quanto no contrato público.

### Evidências do fix round

- RED da regressão de matriz: `rtk npx tsx --test shared/propertySchema.test.ts shared/featureCatalog.test.ts` — 23 aprovados, 1 falha esperada (`house/penthouse` ainda aceito).
- GREEN: o mesmo teste — 24 aprovados, 0 falhas.
- Typecheck focado: `rtk npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext --allowImportingTsExtensions --esModuleInterop shared/featureCatalog.ts shared/propertySchema.ts shared/apiContract.ts shared/featureCatalog.test.ts shared/propertySchema.test.ts` — sem erros.
