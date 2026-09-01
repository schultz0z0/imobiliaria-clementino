# Endereço público completo dos imóveis

## Objetivo

Exibir no website e na prévia o endereço cadastrado no painel no formato canônico:

`Logradouro[, Número] - Bairro, Cidade - UF`

O número aparece somente quando estiver preenchido. Complemento e CEP permanecem fora da experiência pública.

## Arquitetura

O endereço público será formatado por uma função compartilhada no domínio de publicação. O publisher e a prévia usarão essa mesma função ao criar `WebsiteProperty.location` e `WebsiteProperty.address`. Os campos de faceta (`district`, `city` e `state`) continuam separados e não mudam.

O componente `PropertyMap` já usa `property.location` tanto no embed quanto no link “Abrir no Google Maps”. Ao receber o endereço canônico, mapa, texto, link, página de detalhes, metadados e prévia permanecerão consistentes sem duplicar regras no React.

## Fluxo de dados

1. O painel continua salvando `privateAddress.street`, `number`, `district`, `city` e `state` no PostgreSQL.
2. O publisher lê a revisão publicada e formata o endereço público completo.
3. O catálogo estático recebe esse valor em `location` e `address`.
4. Página de detalhes e Google Maps consomem o mesmo valor.
5. A prévia formata o rascunho com a mesma função antes de renderizar.

## Regras e fallback

- Remover espaços excedentes de cada parte.
- Omitir vírgula e número quando `number` estiver ausente ou vazio.
- Nunca publicar `complement` ou `postalCode`.
- Manter um fallback defensivo com as partes disponíveis, embora a validação de publicação já exija logradouro, bairro, cidade e UF.

## Testes

- Endereço com número.
- Endereço sem número e sem pontuação órfã.
- Normalização de espaços.
- Publisher e prévia produzindo o mesmo valor.
- `PropertyMap` usando o endereço completo no embed e no link externo.
- Suíte, lint e builds de produção antes do deploy.

## Implantação

Nenhum cadastro será alterado ou migrado. Após o deploy, o catálogo público será reconstruído uma vez a partir das revisões já publicadas no banco, tornando o novo formato visível para todos os imóveis.
