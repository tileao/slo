# SLO — Circuito Offshore Diurno

Módulo da suíte **AW139 Companion** para planejamento e briefing do circuito
de pouso offshore diurno em Unidades Marítimas (UM).

Ferramenta **pessoal de estudo e briefing** — não substitui SOP, MGO ou RFM
vigentes.

## O que faz

A partir dos dados da UM (classe e posição do helideque, aproamento,
orientação do "H", SLO) e do vento:

- sugere a **proa de aproximação final** — preferencialmente dentro do
  prolongamento dos limites laterais do SLO; defasagem além dos limites
  (máx. 45° do "H") somente quando o través exigir, sempre inferior ao
  limite da aeronave — ou valida uma proa manual;
- calcula componentes de **vento de proa e través** na final;
- aplica a **reclassificação da classe do helideque** com vento de alheta/popa
  e valida a classe declarada contra a posição do helideque (NORMAM-223);
- confere o **movimento do helideque** (balanço/caturro, inclinação, razão de
  arfagem e arfagem) contra os limites diurnos da Tabela 1 da NORMAM-223
  (helicóptero categoria B) para a classe efetiva;
- monta o **circuito de tráfego** (lado das curvas pelo lado do PF, proas das
  pernas, GS estimada, distâncias de referência, 500 ft RADALT / 80 KIAS);
- define o **plano de arremetida** e exibe cartões de referência
  (aproximação estabilizada, comunicações e checklists);
- desenha o **diagrama do circuito** (UM, SLO, SOAL, vento e pernas) em
  canvas, com tela cheia e exportação em PDF.

As regras implementadas seguem o `SLO MODULE SPEC.md` (Omni SOP 52 Rev. 00 +
NORMAM-223/DPC Rev. 2025), com as constantes centralizadas no objeto `SPEC`
do `app.js`.

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
