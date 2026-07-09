# SLO — Circuito Offshore Diurno

Módulo da suíte **AW139 Companion** para planejamento e briefing do circuito
de pouso offshore diurno em Unidades Marítimas (UM).

Ferramenta **pessoal de estudo e briefing** — não substitui SOP, MGO ou RFM
vigentes.

## O que faz

A partir dos dados da UM (classe e posição do helideque, aproamento da UM,
aproamento do helideque — a bissetriz do SLO, voltada para o mar; o "H" é
pintado perpendicular a ela —, SLO) e do vento:

- sugere a **proa de aproximação final** (defasagem máxima de 45° do "H",
  vento de través dentro do limite da aeronave) ou valida uma proa manual;
- calcula componentes de **vento de proa e través** na final;
- aplica a **reclassificação da classe do helideque** com vento de alheta/popa;
- escolhe o **lado do PF automaticamente** (vento de través e geometria do
  SLO) e monta o **circuito de tráfego** (curvas pelo lado do PF, proas das
  pernas, GS estimada, distâncias de referência, 500 ft RADALT / 80 KIAS);
- desenha a **final deslocada** para o ponto imaginário abeam o helideque,
  com LDP (deslocamento de 45° para o pouso) e escape reto em frente;
- define o **plano de arremetida** e exibe cartões de referência
  (aproximação estabilizada, comunicações e checklists);
- desenha o **diagrama do circuito** (UM, SLO, vento e pernas) em canvas,
  com tela cheia e exportação em PDF.

## Como testar localmente

```bash
python3 -m http.server 8080
# abrir http://localhost:8080
```

100% estático (HTML/CSS/JS puro, sem build). Funciona offline após o primeiro
carregamento (service worker próprio para uso standalone).

## Integração com o AW139 Companion

O módulo foi feito para ser incorporado como subpasta `/slo/` do app
principal:

- grava no contexto compartilhado (`aw139_companion_shared_context_v1`) os
  campos `circuitoFinalHeading`, `circuitoLado`, `circuitoHeadwindKt`,
  `circuitoCrosswindKt` e `circuitoUmIcao`;
- reage a eventos `input`/`change` disparados programaticamente (compatível
  com o `module-bridge`);
- respeita os query params `?embed=1` e `?back=1&return=<url>`;
- caminhos relativos em todos os assets.

Ao integrar, adicionar os arquivos ao `PRECACHE` do `sw.js` do app principal
e incrementar o `CACHE_NAME`.
