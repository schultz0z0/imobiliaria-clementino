# Contrato de identidade do catálogo de imóveis

Este documento define como cada imóvel do `content/imoveis` é ligado ao catálogo consumido pelo site. O nome do imóvel não é sua identidade e pode ser editado.

## Fonte de verdade

Cada imóvel possui uma pasta em `content/imoveis/` e um arquivo `dados_imovel.json`. Esse conteúdo é a fonte de verdade do catálogo.

O site não lê essas pastas diretamente durante a navegação. O comando `npm run catalog:generate` valida e transforma o conteúdo em `src/data/properties.generated.json`, que é consumido pelo React.

Não edite `src/data/properties.generated.json` manualmente. Toda correção permanente deve começar no respectivo `dados_imovel.json` e ser propagada pela geração do catálogo.

## Identificadores

| Campo | Papel | Pode mudar? | Precisa ser único? |
| --- | --- | --- | --- |
| `dados_gerais.id_imovelweb` | Chave técnica que liga conteúdo, catálogo e imagens | Não | Sim |
| `dados_gerais.codigo_imovel` | Referência comercial exibida como `Ref.` | Somente por decisão comercial | Não é garantido atualmente |
| `dados_gerais.titulo` | Nome editorial mostrado no site | Sim | Não |
| `property.slug` | Endereço público derivado de título + ID | Pode mudar quando o título mudar | Sim no catálogo gerado |

### Regra principal

`id_imovelweb` é a identidade técnica imutável do imóvel.

Exemplo:

```text
ID técnico: 3017305809
Referência comercial: CA002
Content: content/imoveis/copacabana-av.-atlantica-cobertura-linear-425m-4-3017305809/
Imagens públicas: public/imoveis/3017305809/
```

Mesmo que o título seja alterado, o `id_imovelweb` deve continuar `3017305809`. Isso permite reconhecer o mesmo imóvel no conteúdo, no catálogo gerado e nas imagens.

## Fluxo de ligação

```text
content/imoveis/<nome>-<id>/dados_imovel.json
  dados_gerais.id_imovelweb
          ↓
scripts/catalog/normalizeProperty.ts
          ↓
src/data/properties.generated.json
  id, reference, slug e caminhos de imagens
          ↓
cards, busca, página individual, SEO e mensagens de WhatsApp
```

No catálogo do site:

- `id` recebe `id_imovelweb`;
- `reference` recebe `codigo_imovel` e usa o ID como fallback;
- `slug` é gerado com o título e o ID;
- as imagens usam `/imoveis/<id>/...`;
- a busca considera título, localização, referência e ID;
- cards, página individual e WhatsApp exibem ou enviam a referência comercial.

## Regras protegidas pelo código

A geração do catálogo falha quando:

- `id_imovelweb` está ausente;
- dois imóveis possuem o mesmo `id_imovelweb`;
- dois imóveis produzem o mesmo slug;
- campos obrigatórios ou fotos estão ausentes;
- o catálogo gerado está diferente da fonte em `content/imoveis`.

Use os comandos abaixo depois de qualquer alteração:

```bash
npm run catalog:generate
npm run catalog:verify
npm test
```

## Como alterar um imóvel sem perder a ligação

1. Localize a pasta pelo `id_imovelweb`, não apenas pelo título ou pela referência.
2. Edite o `dados_imovel.json` dentro dessa pasta.
3. Preserve o valor de `dados_gerais.id_imovelweb`.
4. Atualize também `README.md` e `imovel.md` da pasta quando a informação comercial aparecer neles.
5. Execute `npm run catalog:generate`.
6. Execute as validações do catálogo e os testes.

O título pode ser alterado seguindo esse fluxo. O imóvel continuará ligado ao conteúdo pelo ID técnico, embora o slug público gerado possa mudar.

## Referência comercial não é chave técnica

O catálogo atual possui referências comerciais repetidas:

- `0085`: IDs `3038426799` e `3042851381`;
- `0017`: IDs `3018791156` e `3021262193`.

Por isso, uma solicitação de alteração deve informar preferencialmente o ID do Imovelweb ou o link completo do anúncio. A `Ref.` continua útil para atendimento e exibição, mas não deve ser usada sozinha para identificar registros em automações.

Essas referências não devem ser alteradas automaticamente. Qualquer correção depende de confirmação comercial do responsável pelo catálogo.
