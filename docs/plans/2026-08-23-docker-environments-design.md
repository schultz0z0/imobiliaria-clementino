# Ambientes Docker de Desenvolvimento e Produção

## Objetivo

Configurar o site para desenvolvimento local no Docker Desktop/Windows com hot reload e para produção em uma VPS Linux, onde o projeto será clonado e construído com Docker Compose.

## Arquitetura

O ambiente local executará o Vite em um container Node.js e publicará a porta `4174`. O código-fonte será montado no container, enquanto as dependências ficarão em um volume Docker separado para evitar incompatibilidades entre Windows e Linux. O monitoramento de arquivos usará polling para oferecer hot reload confiável no Docker Desktop.

Em produção, o Dockerfile multi-stage existente construirá os arquivos estáticos com Node.js e os servirá com Nginx. O Compose de produção não incluirá nem dependerá diretamente do serviço Traefik. O Traefik continuará em seu Compose isolado, usando `network_mode: host` e o Docker Socket para descobrir o container do site pelas labels.

## Roteamento de produção

O router principal atenderá `clementinoimoveis.com.br` no entrypoint `websecure`, usando o resolver `letsencrypt`. Um segundo router atenderá `www.clementinoimoveis.com.br` e aplicará um middleware de redirecionamento permanente para o domínio sem `www`.

O container exporá apenas a porta interna `80`. O provider Docker do Traefik obterá o IP privado do container e usará a label explícita da porta do load balancer. Nenhuma porta do site será publicada diretamente pela VPS.

## Arquivos

- `Dockerfile.dev`: imagem Node.js para desenvolvimento.
- `compose.dev.yaml`: serviço local com bind mount, volume de dependências, porta 4174 e hot reload.
- `compose.prod.yaml`: build de produção, healthcheck, política de reinício e labels do Traefik.
- `.env.production.example`: domínio configurável e nome do projeto Compose, sem segredos.
- `README.md`: operação local e instruções de implantação na VPS.

## Confiabilidade e diagnóstico

O serviço de produção terá healthcheck HTTP contra o Nginx e `restart: unless-stopped`. A configuração será validada com `docker compose config`; as imagens de desenvolvimento e produção serão construídas localmente; o site será verificado por HTTP em ambos os modos. A documentação incluirá comandos para logs, atualização e recriação do serviço.

## Premissas

- O Traefik e o site executam no mesmo Docker Engine da VPS.
- O Traefik mantém acesso somente leitura a `/var/run/docker.sock`.
- Os entrypoints existentes se chamam `web` e `websecure`.
- O certificate resolver existente se chama `letsencrypt`.
- Antes da implantação, os registros DNS de `clementinoimoveis.com.br` e `www.clementinoimoveis.com.br` apontarão para a VPS.
