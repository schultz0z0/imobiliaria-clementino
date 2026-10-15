# SEO automático do catálogo publicado e nova marca

O banco de produção é a fonte dos imóveis. O catálogo local não deve ser importado,
restaurado ou usado para substituir dados da VPS nesta atualização.

## Diagnóstico

O build gera HTML e llms-full.txt a partir de properties.generated.json. O publisher
copia esse build e atualiza somente catalog.json e sitemap.xml. O Nginx ainda dá
preferência ao HTML do build. Os 47 imóveis atuais chegam com canonical da home;
os 53 links de llms-full.txt pertencem ao catálogo anterior. O React corrige o head
depois de carregar, mas o conteúdo inicial contém apenas uma tela de carregamento.

## Decisão

Reutilizar os geradores de metadados, schema e arquivos do projeto. A API pública
servirá documentos HTML e de indexação usando somente revisões publicadas do banco,
com cache curto, sem acesso aos rascunhos e preservando a regra existente de
endereço público (logradouro/número, sem complemento/CEP). Nginx encaminhará
documentos para essa API e continuará servindo assets localmente. A publicação
também produzirá os mesmos artefatos a partir do catálogo publicado.

Alternativas consideradas: regenerar apenas durante publicação deixaria mudanças
de status sem sincronização; renderizar apenas no navegador manteria o problema
de leitura sem JavaScript. A renderização pública por leitura do banco cobre
edição, publicação, inativação, locação e retorno ao catálogo sem migrar dados.

Cada imóvel terá título, descrição, canonical, imagem social, JSON-LD, H1,
descrição, características e links reais no HTML inicial. Páginas inexistentes
responderão 404/noindex; falha de infraestrutura responderá 503, nunca falso 404.
Sitemap e llms-full utilizarão o mesmo conjunto de imóveis publicados. Robots
permitirá as imagens públicas sem liberar endpoints privados. llms.txt é conteúdo
auxiliar e não uma garantia de indexação ou de recomendação por IA.

## Marca

Usar as imagens fornecidas, preservando desenho, proporções e transparência.
Preparar recortes/versões menores para menu, rodapé, marca administrativa e favicon.
Manter o layout existente e verificar desktop e celular.

## Produção

Nenhuma alteração de esquema, importação, seed, restauração de dados locais ou
remoção de volumes faz parte do trabalho. Antes do deploy, comparar o código/serviços
reais da VPS, registrar contagens e criar backup verificável do banco e mídia.
Atualizar somente serviços necessários; não substituir o frontend administrativo
divergente sem comparar suas alterações. Preservar imagens anteriores para rollback.

## Validação

Testes com um catálogo diferente do arquivo local; conferência de publicação,
edição e retirada do catálogo; metadados e texto sem JavaScript; XML/JSON-LD válido;
404, prévia noindex e falha 503; build do site e API; inspeção visual da marca.
