# Repertório de animações — Jotapê

Biblioteca de estudo para o futuro website da Jotapê. Os exemplos são React +
TypeScript e priorizam impacto visual sem sacrificar leitura, conversão,
acessibilidade ou desempenho.

> Estes arquivos são referências isoladas, não uma decisão de implementação.
> Na etapa de desenvolvimento, cada efeito deve justificar sua presença no
> funil e ser medido em mobile.

## Estrutura

- `21st/`: código recuperado pelo MCP do 21st.dev, com origem preservada.
- `microinteracoes/`: animações de elementos e CTAs.
- `secoes/`: padrões de scroll e storytelling para blocos completos.
- `experiencias-completas/`: exemplos de composição de uma Home.
- `fundamentos/`: configuração global, smooth scroll e tokens de movimento.
- `catalogo-21st.md`: referências visuais salvas no 21st, inclusive as que não
  tiveram o código recuperado por limite diário.
- `fontes.md`: documentação técnica usada como base.

## Dependências sugeridas

```bash
npm install motion gsap @gsap/react lenis
```

Os dois exemplos vindos do 21st usam `framer-motion`, conforme a fonte. Em um
projeto novo, a preferência é padronizar os exemplos próprios em `motion/react`.

## Hierarquia de uso na Home

1. **Hero:** uma animação de entrada curta; headline e CTA legíveis desde o
   primeiro instante.
2. **Prova:** logos e números com movimento discreto.
3. **Cases:** maior investimento de movimento — previews, pinning e narrativa.
4. **Serviços/método:** transições que expliquem relações, sem espetáculo
   gratuito.
5. **CTA final:** microinteração clara, mantendo o botão estável.

## Orçamento de movimento

- Primeiro conteúdo útil visível em até ~1 s.
- Evitar intro bloqueante e scroll-jacking.
- Preferir `transform`, `opacity`, `clip-path` e Motion Values.
- Desativar parallax, pinning agressivo, vídeo automático e cursores customizados
  quando `prefers-reduced-motion: reduce` estiver ativo.
- Em telas touch, não depender de hover para revelar informação essencial.
- Pausar loops e vídeos quando a página não estiver visível.

## Mapa rápido

| Objetivo | Referência | Melhor uso |
|---|---|---|
| Impactar sem esconder a proposta | `CinematicConversionHero.tsx` | Hero da Home |
| Revelar uma afirmação | `AccessibleSplitReveal.tsx` | Manifesto/título |
| Tornar CTA tátil | `MagneticCta.tsx` | CTA primário, desktop |
| Mostrar cases com personalidade | `ProjectHoverPreview.tsx` | Lista editorial de cases |
| Explicar método/capacidades | `StickyStorySection.tsx` | Seção de processo |
| Criar galeria imersiva | `HorizontalCasesGsap.tsx` | Cases selecionados |
| Orquestrar a Home | `ConversionHomeMotion.tsx` | Exemplo completo |

## Regra de seleção para a Jotapê

Uma animação entra no produto quando cumpre pelo menos uma função:

- captura atenção para uma mensagem;
- demonstra hierarquia;
- conecta causa e efeito;
- apresenta um case de forma mais memorável;
- reforça a ação seguinte.

Se ela apenas aumenta o tempo até o CTA, fica fora.

