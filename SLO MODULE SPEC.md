# a139comp — Módulo /slo · Especificação de Regras
**Planejamento do circuito de tráfego offshore diurno e análise de SLO**
Fontes: Omni SOP 52 Rev. 00 (01/07/2026) e NORMAM-223/DPC Rev. 2025 (arts. 4.2, 4.3, 4.4, 4.6 e cap. 9).
Documento de estudo/desenvolvimento pessoal. Em operação, prevalecem os documentos oficiais.

---

## 1. Geometria do SLO (NORMAM-223, art. 4.2)

- Setor de **210° livre de obstáculos**, no plano horizontal coincidente com o plano do helideque.
- **Limites laterais:** semirretas com origem no **vértice do chevron** (ponto de referência), formando 210° entre si, externas à AAFD.
- **Limite externo:** linha paralela ao limite da AAFD até **500 m**.
- A **bissetriz do SLO** passa normalmente pelo centro da Área de Toque. O chevron pode ter **variação de até ±15°**; nesse caso o traço horizontal do "H" fica paralelo à bissetriz do SLO variado.
- **Unidades acopladas** (gangway): SLO reduzido a **180°**, mantida a pintura da habilitação. Passagem apenas de cabos/dutos (pull in, offloading) NÃO caracteriza acoplamento.
- **SOAL** (setor replementar de **150°**, art. 4.4): obstáculos limitados — até 0,25 m no raio 0,62D; gradiente 1:2 entre 0,62D e 0,83D. **É proibido sobrevoar o SOAL.**
- **Gradiente negativo** (art. 4.3): setor de ≥180° abaixo do nível do helideque (3 m vertical : 1 m horizontal até a água). Sobrevoo da faixa de alerta não é proibido, mas deve ser evitado.
- Regra de ouro (SOP 52 §5.12 + NORMAM obs. 4.2): **a entrada sobre o helideque (LDP → círculo de toque) ocorre sempre com o helicóptero integralmente contido nos limites laterais e externo do SLO**, cauda totalmente livre de obstáculos.

## 2. Classes de helideque (NORMAM-223 cap. 9 / SOP 52 §5.2)

| Classe | Descrição | Regras fixas |
|---|---|---|
| 1 | Boas referências visuais: semissubmersíveis, FPSO, FSU, cábreas/barcaças, navios-tanque convertidos e porte equivalente | — |
| 2 | Boas referências visuais; helideque na **popa ou meia-nau** (DSV, sísmicos, apoio marítimo) | Meia-nau é **sempre** classe 2 |
| 3 | Poucas referências visuais; helideque na **proa ou acima da superestrutura** | Proa/superestrutura é **sempre** classe 3; adaptados sobre hatch cover ou lateral do convés são **sempre** classe 3 |

**Reclassificação por vento (lógica a implementar):**
- Classe 2 com vento de **alheta ou popa** → tratar como Classe 3.
- Classe 3 com vento de **alheta ou popa** → tratar como Classe 2 (e, à noite, pode usar parâmetros noturnos de Classe 2).
- Operação **noturna** em Classe 3 é proibida nas AJB (exceto a reclassificação acima).

**Limites de movimento da UM — helicóptero categoria B (inclui AW139), NORMAM Tabela 1:**

| Classe | Período | Balanço/Caturro | Inclinação | VArf (m/s) | Arfagem (m) |
|---|---|---|---|---|---|
| 1 | Diurno | ±4° | 4,5° | 1,3 | 5,0 |
| 1 | Noturno | ±4° | 4,5° | 1,0 | 4,0 |
| 2 | Diurno | ±3° | 3,5° | 1,0 | 3,0 |
| 2 | Noturno | ±2° | 2,5° | 0,5 | 1,5 |
| 3 | Diurno | ±3° | 3,5° | 1,0 | 3,0 |
| 3 | Noturno | proibido* | — | — | — |

\*Exceto reclassificação por vento de alheta/popa. Valores = máximos dos últimos 20 min. SVArf = média dos 3 maiores valores instantâneos em 20 min (≈ 2 × RMS).

## 3. Proa de aproximação final (SOP 52 §5.4)

Regra em camadas, nesta ordem:
1. **Preferencial:** trajetória dentro do setor definido pelo **prolongamento dos limites laterais do SLO** (bissetriz ± 105°).
2. **Tolerância por vento lateral:** defasagem de até **30° além dos limites laterais do SLO**, o que equivale a **no máximo 45° em relação à orientação do "H"**, desde que preservadas as margens de obstáculos e o limite de vento de través da aeronave.
3. **> 45° do "H" = fora dos limites** → aproximação deve ser descontinuada; novo circuito com proa ajustada.
4. Se não for possível satisfazer simultaneamente (proa ≤ 45° do "H") **e** (vento de través ≤ limite do equipamento) → **descontinuar**.
5. Independentemente da proa: no **LDP**, trajetória integralmente dentro do SLO.

Entradas para a decisão: direção/intensidade do vento, componente de vento cruzado, posicionamento do helideque na UM e orientação do "H".

**Princípio operacional:** nunca continuar aproximação para helideque fora do campo visual do PF e não identificado positivamente; arremetida imediata com curva para o lado seguro.

## 4. Circuito de tráfego diurno (SOP 52 §5.8–5.11)

Parâmetros do perfil (500 ft RADALT / 80 KIAS em todo o circuito):

| Elemento | Valor |
|---|---|
| Sobrevoo de identificação | Obrigatório, 80 KIAS, UM pelo lado do PF; leitura do código ICAO (PF lê, PM coteja com Flight Preview) |
| Perna do vento | Separação lateral **1,0 NM**, proa oposta à final; PF mantém contato visual; estende até **1,5–1,8 NM** GPS (≈1 min após o través); rebriefar lado da curva de arremetida |
| Perna base | Início entre **1,5 e 1,8 NM** GPS; 500 ft / 80 KIAS; curva de 90° com correção de deriva; **bank ≤ 20°**; UM em contato visual contínuo |
| Aproximação final | Início entre **1,2 e 1,5 NM** da AAFD; FINAL APPROACH CHECKLIST; redução gradual para **60 kt GS**; curso no FMS é só referência |
| Curvas do circuito | Preferencialmente para o lado do PF; troca de função PF/PM permitida após o sobrevoo ou ao ingressar na final ("You have control" / "I have control") |

Notas: automação recomendada, mas circuito com referências visuais e comandos guarnecidos; voo manual permitido (MGO 11.13.7); briefing deve enfatizar pontos de transição automação↔manual.

## 5. Aproximação estabilizada (SOP 52 §5.3 / MGO 11.13.8)

- Final inicia a **500 ft (RADALT) e 80 KIAS**.
- Estabilizada garantida **antes de 0,5 NM** do local de pouso.
- Velocidade na final VFR: **75–85 kt**.
- Razão de descida: **< 700 ft/min acima de 500 ft**; **≤ 500 ft/min abaixo de 500 ft**; **≤ 350 ft/min no segmento final**.
- Perda de altura concomitante à redução de velocidade; correções de rumo **≤ 5°**; configuração de pouso completa, briefings/checklists completos; potência ≥ mínimo do fabricante.
- PF não reage aos callouts de desvio / só corrige suavemente → **arremeter**.

## 6. Gatilhos obrigatórios de arremetida (SOP 52 §5.11)

Arremeter sempre que qualquer um for verdadeiro:
1. Critérios de aproximação estabilizada não cumpridos;
2. **Status Light acesa**;
3. Impossível garantir trajetória dentro do SLO **antes do LDP**;
4. Condição insegura ou obstáculo na trajetória;
5. Reidentificação da UM (código ICAO) não realizada ou em dúvida.

Filosofia: **na dúvida, arremetida é obrigatória**; arremetida é manobra de segurança incentivada e não é evento de FDM.

## 7. Comunicações e sequência temporal (SOP 52 §5.5–5.7)

1. **T−30 min** (ou ASAP se mais perto da costa): chamada bilateral compulsória (exceto UM desabitada). PM informa nº do voo, origem/destino, POB pouso/decolagem, carga, ETA; solicita **coordenadas da UM** (rádio operador dita — PM nunca sugere a coordenada); PF e PM conferem com o waypoint ativo do FMS.
2. **T−5 min**: rádio operador transmite proa da UM + vento → atualizar planejamento do circuito.
3. **Before Landing Checklist**: iniciar após a chamada de 5 min; aeronave **configurada até 5 NM**.
4. Sobrevoo a 80 KIAS: confirmar vento (biruta/fumaça/shadow effect/flare da chaminé), obstáculos/pássaros, orientação do "H"/SLO, embarcações no SLO (offloading/acopladas), **Status Light apagada**, UM semelhantes nas proximidades.
5. Na final: PM informa ao rádio operador "na final, trem baixado e travado (checado)"; intenções na **frequência de coordenação offshore**.

## 8. Barreiras contra WDL (SOP 52 §5.13)

Cadeia de erro: seleção visual prematura (>5 NM) → viés de confirmação → abandono do cross-check FMS → quebra de independência PF/PM → falha na barreira final (ICAO code). Implicações para o módulo: reforçar leitura independente do código ICAO na vertical **e** na curta final antes do LDP; sugerir a pergunta "o que indica que pode estar errado?" no lugar de confirmação positiva.

## 9. Constantes para implementação

```json
{
  "slo": { "sectorDeg": 210, "coupledSectorDeg": 180, "externalLimitM": 500,
           "chevronVariationDeg": 15, "soalSectorDeg": 150 },
  "finalHeading": { "preferredWithinSloExtension": true,
                    "maxBeyondSloDeg": 30, "maxFromHDeg": 45 },
  "windLimitsAW139": { "maxCrosswindKt": 20,
                       "crossThresholdKt": 10, "minHeadwindKt": 5,
                       "nota": "través máximo de 20 kt; acima de 10 kt de través, componente de proa mínima de 5 kt" },
  "circuit": { "altFtRadalt": 500, "iasKt": 80,
               "downwindLateralNM": 1.0, "downwindExtendNM": [1.5, 1.8],
               "baseStartNM": [1.5, 1.8], "baseMaxBankDeg": 20,
               "finalStartNM": [1.2, 1.5], "finalTargetGsKt": 60 },
  "stabilized": { "guaranteedByNM": 0.5, "iasRangeKt": [75, 85],
                  "rodAbove500Fpm": 700, "rodBelow500Fpm": 500,
                  "rodFinalSegmentFpm": 350, "maxHeadingChangeDeg": 5 },
  "timeline": { "initialCallMin": 30, "updateCallMin": 5,
                "configuredByNM": 5 },
  "deckLimitsCatB": {
    "class1": { "day": { "rollPitchDeg": 4, "incDeg": 4.5, "heaveRateMs": 1.3, "heaveM": 5.0 },
                "night": { "rollPitchDeg": 4, "incDeg": 4.5, "heaveRateMs": 1.0, "heaveM": 4.0 } },
    "class2": { "day": { "rollPitchDeg": 3, "incDeg": 3.5, "heaveRateMs": 1.0, "heaveM": 3.0 },
                "night": { "rollPitchDeg": 2, "incDeg": 2.5, "heaveRateMs": 0.5, "heaveM": 1.5 } },
    "class3": { "day": { "rollPitchDeg": 3, "incDeg": 3.5, "heaveRateMs": 1.0, "heaveM": 3.0 },
                "night": null }
  }
}
```

## 10. Algoritmo sugerido de planejamento (pseudocódigo)

```
ENTRADAS: proaUM, posicaoHelideque (proa|popa|meiaNau|lateral),
          orientacaoH (graus), classeDeclarada, acoplada (bool),
          ventoDir, ventoInt, limiteVentoTraves (SOP do equipamento),
          ladoPF (esq|dir)

1. setorSLO = acoplada ? 180 : 210
   limitesSLO = orientacaoH ± (setorSLO/2)          // bissetriz = orientação do H

2. classeEfetiva = reclassificar(classeDeclarada, ventoRelativoAoNavio)
   // alheta/popa: classe2→3, classe3→2

3. Para cada proaCandidata (varredura ou proa do vento arredondada):
   a. desvioH = |dif_angular(proaCandidata, orientacaoH)|
   b. dentroSLO   = desvioH <= setorSLO/2            // preferencial
      tolerado    = desvioH <= 45                    // 30° além do SLO
   c. ventoTraves = ventoInt * sin(dif_angular(ventoDir, proaCandidata))
      ok_vento    = |ventoTraves| <= limiteVentoTraves
   d. score: dentroSLO+ok_vento > tolerado+ok_vento > inválida

4. Se nenhuma proaCandidata com (desvioH<=45 E ok_vento) → "circuito inviável,
   descontinuar/reavaliar" (SOP 52 §5.4)

5. Com proaFinal escolhida:
   perna_vento  = reciproca(proaFinal), afastamento 1,0 NM,
                  lado = ladoPF (curvas para o lado do PF)
   perna_base   = proaFinal ± 90 (conforme lado), início 1,5–1,8 NM
   final        = proaFinal, início 1,2–1,5 NM, alvo 60 kt GS
   sobrevoo     = UM pelo lado do PF, 80 KIAS

6. SAÍDAS: proas das 4 pernas, lado das curvas, avisos
   (reclassificação de classe, desvioH em zona tolerada 30°/45°,
    vento de través marginal, lembretes: ICAO code na vertical e na
    curta final, rebriefar arremetida na perna do vento)
```

**Casos de teste sugeridos:** (1) FPSO com vento alinhado ao H → final = H, tudo verde; (2) vento forçando 40° do H → zona tolerada, alerta amarelo; (3) vento forçando 50° do H → inviável; (4) NS classe 2 com vento de popa → reclassificar p/ 3; (5) UM acoplada → setor 180°; (6) vento de través acima do limite em todas as proas ≤45° → descontinuar.
