# Retrato institucional na Home e em Sobre — design

## Objetivo

Substituir as imagens de imóveis usadas nas seções institucionais da Home e da rota `/sobre` pelo retrato fornecido pelo usuário.

## Decisão aprovada

- Usar a opção 1: recorte focal responsivo.
- Preservar os layouts atuais em proporção 4:3.
- Converter a imagem PNG para um único WebP otimizado em `public/images/brand/institutional-portrait-clementino.webp`.
- Reutilizar o mesmo asset nas duas rotas.
- Aplicar `object-position: center 35%` para privilegiar rosto e tronco sem distorção.
- Usar o texto alternativo “Retrato institucional da Imobiliária Clementino”, sem presumir publicamente a identidade da pessoa fotografada.

## Validação

Testes automatizados devem confirmar asset, texto alternativo e ponto focal nas duas superfícies. A validação visual deve cobrir desktop e mobile, verificando enquadramento, carregamento e ausência de overflow.
