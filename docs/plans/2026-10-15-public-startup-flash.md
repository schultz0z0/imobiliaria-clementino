# Correção do flash no carregamento público

O HTML público contém o catálogo e os metadados antes do JavaScript para permitir leitura e indexação. O React usa createRoot e substitui esse conteúdo; a lista sem o layout final aparece durante a transferência do bundle. Reprodução registrada com o JavaScript adiado no navegador público.

Correção: reaproveitar a apresentação de carregamento da marca durante a inicialização, com CSS crítico e um guard pequeno executado antes da primeira pintura. Liberar a aplicação no primeiro commit do React, quando o CSS importado já está carregado. Manter o mesmo HTML para todos os agentes.

Sem JavaScript, o conteúdo inicial permanece disponível e a tela de carregamento não aparece. Em erro de módulo ou após oito segundos sem inicialização, liberar o conteúdo público; uma inicialização tardia ainda funciona. Não modificar o cadastro, banco, volumes ou serviços administrativos.

Validação:

1. Registrar o comportamento esperado em testes: sem JS, inicialização pendente, commit, timeout, erro de módulo e renderização repetida.
2. Executar e observar as falhas antes da correção.
3. Implementar o guard e sinalizar o commit pela entrada React.
4. Testar em Chromium desktop e celular com módulos e CSS adiados, bloqueados e JavaScript desabilitado; conferir o HTML e o catálogo.
5. Executar lint, build e testes existentes; revisar o diff antes de publicar.
6. Atualizar somente os serviços públicos na VPS com novo acesso temporário; conferir preservação dos dados e repetir a validação pública.
