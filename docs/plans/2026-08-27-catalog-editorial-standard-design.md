# Padronização editorial do catálogo — design

## Objetivo

Revisar os títulos e as descrições dos 53 imóveis em português brasileiro claro e natural, mantendo intacta a identidade técnica e todos os dados comerciais do catálogo.

## Abordagens consideradas

1. **Revisão editorial imóvel por imóvel — escolhida.** Usa somente fatos existentes no próprio conteúdo, corrige contexto e permite títulos curtos sem perder o diferencial real de cada anúncio.
2. **Normalização automática em tempo de execução.** Seria mais rápida, mas produziria títulos mecânicos e teria risco de interpretar abreviações e frases truncadas incorretamente.
3. **Correção apenas na camada visual.** Evitaria alterar o content, porém deixaria a fonte de verdade contaminada e faria o problema reaparecer em SEO, compartilhamento e futuras integrações.

## Regra de títulos

Estrutura principal:

```text
[Tipo do imóvel] em [bairro] — [rua, condomínio ou principal diferencial]
```

Regras complementares:

- escrever por extenso: `apartamento`, `quartos`, `banheiros`, `Vigário Geral`;
- não repetir área, quartos, banheiros, vagas e preço quando esses dados já aparecem nos blocos estruturados;
- usar no máximo um ou dois diferenciais realmente úteis;
- não incluir finalidade no título, pois venda ou aluguel já aparece em destaque na interface;
- evitar caixa alta, abreviações, pontuação duplicada e frases promocionais;
- preservar o bairro informado pela fonte, sem inferir nova localização.

## Regra de descrições

- escrever em português brasileiro natural, com frases completas e parágrafos curtos;
- preservar todos os fatos verificáveis existentes: configuração, pavimento, posição, condomínio, acessos e diferenciais;
- remover repetições, abreviações, caixa alta desnecessária, chamadas promocionais genéricas e caracteres corrompidos;
- não inventar infraestrutura, estado de conservação, segurança, proximidades ou condições comerciais;
- não alterar preço, condomínio, IPTU, finalidade, endereço, coordenadas, fotos ou características estruturadas;
- quando uma frase estiver corrompida e não for possível recuperar seu valor com segurança, remover somente o trecho incerto.

## Identidade e propagação

`dados_gerais.id_imovelweb` continuará sendo a chave técnica imutável. `codigo_imovel` continuará sendo a referência comercial. Apenas `dados_gerais.titulo` e `descricao` serão revisados nos arquivos `dados_imovel.json`.

Depois da revisão, o catálogo será regenerado em `src/data/properties.generated.json`. Como o slug contém o título e o ID, ele poderá mudar, mas sempre terminará com o mesmo `id_imovelweb`, preservando a ligação inequívoca entre content, site e imagens.

Os arquivos editoriais `imovel.md` e `README.md` de cada pasta serão sincronizados quando repetirem o título ou a descrição.

## Validação

- confirmar os mesmos 53 IDs antes e depois;
- confirmar que preço, referência, finalidade, endereço, coordenadas, fotos e características não mudaram;
- rejeitar títulos fora do padrão ou com abreviações proibidas;
- procurar caracteres corrompidos e fragmentos de HTML em todas as descrições;
- regenerar e verificar o catálogo;
- executar testes, TypeScript e build de produção;
- conferir uma amostra representativa em mobile e desktop.
