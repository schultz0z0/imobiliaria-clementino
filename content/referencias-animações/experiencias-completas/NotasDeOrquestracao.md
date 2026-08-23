# Orquestração da Home

`ConversionHomeMotion.tsx` demonstra uma experiência completa baseada em AIDA.
Ele não define o layout final; serve para estudar ritmo e prioridade.

## Ritmo recomendado

| Momento | Movimento | Objetivo |
|---|---|---|
| 0–800 ms | headline e CTA entram | atenção e compreensão |
| primeira dobra | vídeo com parallax discreto | ambientação cinematográfica |
| após o hero | números praticamente estáticos | credibilidade e descanso |
| manifesto | palavras ganham contraste pelo scroll | reposicionamento percebido |
| cases | hover preview ou galeria horizontal | desejo e prova visual |
| método | conteúdo sticky sincronizado | explicar integração |
| CTA final | bloco de cor + magnetismo leve | ação |

## O que não combinar na mesma página

- Hero 3D pesado + vídeo 4K + cursor com partículas.
- Smooth scroll forte + seções com scroll interno.
- Texto revelado caractere a caractere em todos os títulos.
- Pinning em mais de duas seções extensas.
- Autoplay de múltiplos vídeos simultaneamente.

## Instrumentação futura

- Medir clique no CTA do hero e no CTA final separadamente.
- Registrar visualização de cases e profundidade de scroll.
- Comparar hero em vídeo versus imagem em Web Vitals e conversão.
- Desativar efeitos caros automaticamente em mobile/economia de dados.

