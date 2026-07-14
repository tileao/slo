/* AW139 Companion — Circuito Offshore (SLO)
   Planejamento do circuito de pouso offshore diurno em UM.
   Ferramenta pessoal de estudo/briefing — não substitui SOP, MGO ou RFM. */
(function(){
  'use strict';

  const CTX_KEY = 'aw139_companion_shared_context_v1';
  const SAVE_KEY = 'aw139_slo_form_v1';

  /* ---------- utilidades angulares ---------- */
  const norm = d => ((d % 360) + 360) % 360;
  // diferença assinada a-b em [-180,180]
  const angDiff = (a, b) => { let d = norm(a - b); return d > 180 ? d - 360 : d; };
  const rad = d => d * Math.PI / 180;
  const fmtHdg = h => String(Math.round(norm(h)) === 0 ? 360 : Math.round(norm(h))).padStart(3, '0') + '°';

  const num = v => {
    if (v == null) return null;
    const s = String(v).replace(',', '.').trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  /* componentes de vento sobre uma proa: head + = vento de proa; cross + = pela direita */
  function windComp(windFrom, windKt, heading){
    const d = angDiff(windFrom, heading);
    return {
      head: windKt * Math.cos(rad(d)),
      cross: windKt * Math.sin(rad(d)),
      delta: d
    };
  }

  /* ---------- leitura do formulário ---------- */
  const $ = id => document.getElementById(id);
  const FIELDS = ['umIcao','deckClass','deckPos','shipHeading','sloAngle',
                  'sloBisector','arrivalHdg','finalManual','windFrom','windKt','xwindLimit'];

  function readState(){
    const bisIn = num($('sloBisector').value);
    const deckPos = $('deckPos').value;
    const ship = num($('shipHeading').value);
    // aproamento do helideque: proa → mesmo da UM; popa → recíproca;
    // deslocado da regra (ex.: FPSO com deck rotacionado) → campo manual
    let sloBisector = bisIn != null ? norm(bisIn) : null, bisAuto = false;
    if (sloBisector == null && ship != null){
      if (deckPos === 'proa'){ sloBisector = norm(ship); bisAuto = true; }
      else if (deckPos === 'popa'){ sloBisector = norm(ship + 180); bisAuto = true; }
    }
    return {
      umIcao: ($('umIcao').value || '').trim().toUpperCase(),
      deckClass: $('deckClass').value,
      deckPos,
      shipHeading: ship,
      sloAngle: Number($('sloAngle').value),
      sloBisector, bisAuto,
      arrivalHdg: num($('arrivalHdg').value),
      finalManual: num($('finalManual').value),
      windFrom: num($('windFrom').value),
      windKt: num($('windKt').value) ?? 0,
      xwindLimit: num($('xwindLimit').value) ?? 20
    };
  }

  /* ---------- lógica operacional ---------- */

  /* A bissetriz do SLO (= aproamento do helideque) aponta para o mar.
     O "H" é pintado perpendicular a ela: seu eixo é a referência da final,
     que cruza a boca do SLO passando abeam o deck — assim o escape reto em
     frente permanece sobre a água, dentro do setor. */

  /* defasagem em relação ao sentido mais próximo do eixo do "H" */
  function axisDev(h, bis){
    const a = angDiff(h, norm(bis + 90)), b = angDiff(h, norm(bis - 90));
    return Math.abs(a) <= Math.abs(b) ? a : b;
  }

  /* classificação da proa final pelo ângulo entre a proa e a bissetriz (σ):
     σ ≥ 180 − setor/2        → 'dentro': chegada por dentro do SLO (no 210°,
                                proas 345→195 no sentido horário p/ bissetriz 270)
     σ ≥ 180 − setor/2 − 30°  → 'tolerada': até 30° além dos limites laterais
                                (= 45° da orientação do "H"), desde que o
                                segmento pós-LDP fique dentro do SLO
     abaixo disso             → 'proibida': chegada pelo setor de obstáculos */
  function sloBand(h, st){
    const sea = Math.abs(angDiff(h, st.sloBisector));
    const inLim = 180 - st.sloAngle / 2;
    if (sea >= inLim) return 'dentro';
    if (sea >= inLim - 30) return 'tolerada';
    return 'proibida';
  }

  /* Limites de vento do AW139 na final: través máximo de 20 kt e, acima de
     10 kt de través, exigência de pelo menos 5 kt de componente de proa. */
  const XWIND_HEADWIND_RULE = { crossThresholdKt: 10, minHeadwindKt: 5 };

  function violatesXwindRule(c){
    return Math.abs(c.cross) > XWIND_HEADWIND_RULE.crossThresholdKt &&
           c.head < XWIND_HEADWIND_RULE.minHeadwindKt;
  }

  /* proa final sugerida:
     1) a princípio, aproada ao vento — se a chegada vier por dentro do SLO;
     2) fora disso, considerar as componentes: melhor proa por dentro do SLO
        com través no limite (e proa mínima de 5 kt quando o través passa de
        10 kt) e sem componente de cauda;
     3) em último caso, as tolerâncias (30° além dos limites) e, só então,
        proas com vento de cauda. Vento calmo → eixo do "H". */
  function suggestFinal(st){
    const bis = st.sloBisector;
    if (bis == null) return null;
    if (st.windFrom == null || !st.windKt)
      return { hdg: norm(bis + 90), dev: 0, head: 0, cross: 0, band: 'dentro', calm: true };
    const hw = norm(st.windFrom);
    if (sloBand(hw, st) === 'dentro'){
      const c = windComp(st.windFrom, st.windKt, hw);
      return { hdg: hw, dev: axisDev(hw, bis), head: c.head, cross: c.cross,
               band: 'dentro', intoWind: true };
    }
    const tiers = [null, null, null, null];
    for (let h = 0; h < 360; h++){
      const band = sloBand(h, st);
      if (band === 'proibida') continue;
      const c = windComp(st.windFrom, st.windKt, h);
      if (Math.abs(c.cross) > st.xwindLimit) continue;
      if (violatesXwindRule(c)) continue;
      const t = band === 'dentro' ? (c.head > -1 ? 0 : 2) : (c.head > -1 ? 1 : 3);
      const dev = axisDev(h, bis);
      const score = c.head - 0.05 * Math.abs(dev); // eixo do "H" só como desempate
      if (!tiers[t] || score > tiers[t].score)
        tiers[t] = { hdg: norm(h), dev, head: c.head, cross: c.cross, band, score };
    }
    return tiers[0] || tiers[1] || tiers[2] || tiers[3]; // null => inviável
  }

  /* setor do vento em relação ao aproamento da UM (nomenclatura náutica) */
  function windSector(st){
    if (st.windFrom == null || st.shipHeading == null || !st.windKt) return null;
    const t = Math.abs(angDiff(st.windFrom, st.shipHeading)); // 0=proa … 180=popa
    if (t <= 22.5) return 'proa';
    if (t <= 67.5) return 'bochecha';
    if (t <= 112.5) return 'través';
    if (t <= 157.5) return 'alheta';
    return 'popa';
  }

  /* lado do PF: o deck fica sempre abeam, do lado da UM (recíproco da
     bissetriz); o sentido da final — escolhido pelo vento — define o assento */
  function autoPfSide(st, final){
    const rel = angDiff(norm(st.sloBisector + 180), final.hdg);
    return { side: rel >= 0 ? 'dir' : 'esq' };
  }

  /* Classe 2 <-> 3 com vento de alheta ou popa */
  function effectiveClass(st){
    const sec = windSector(st);
    const cls = st.deckClass;
    if ((sec === 'alheta' || sec === 'popa')){
      if (cls === '2') return { cls: '3', changed: true, sec };
      if (cls === '3') return { cls: '2', changed: true, sec };
    }
    return { cls, changed: false, sec };
  }

  function buildCircuit(finalHdg, st, side){
    const dwHdg = norm(finalHdg + 180);
    const baseHdg = side === 'esq' ? norm(finalHdg + 90) : norm(finalHdg - 90);
    const gs = h => {
      if (st.windFrom == null || !st.windKt) return 80;
      return Math.max(0, Math.round(80 - windComp(st.windFrom, st.windKt, h).head));
    };
    const gsDw = gs(dwHdg);
    // través -> início da base (~1,31 NM ao longo da perna p/ dist GPS 1,65 NM)
    const minAfterAbeam = gsDw > 0 ? ((1.31 / gsDw) * 60).toFixed(1).replace('.', ',') : null;
    // sobrevoo de reconhecimento: passa AO LADO da UM, pelo bordo do helideque
    // (lado da bissetriz — melhor visual do deck); identifica o piloto do lado
    // da UM; após a passagem, proa perpendicular p/ interceptar a perna do
    // vento a 90° e ingressar no circuito
    const ovHdg = st.arrivalHdg != null ? norm(st.arrivalHdg) : finalHdg;
    let arrival = null;
    if (st.arrivalHdg != null){
      // desloca a trilha p/ o lado do mar: perpendicular com componente na bissetriz
      const toSea = Math.cos(rad(angDiff(norm(ovHdg + 90), st.sloBisector)));
      const passBear = norm(ovHdg + (toSea >= 0 ? 90 : -90));
      const unitSide = toSea >= 0 ? 'esq' : 'dir'; // UM fica do lado oposto ao mar
      const entryHdg = norm(finalHdg + (side === 'esq' ? -90 : 90));
      arrival = { hdg: ovHdg, passBear, unitSide, entryHdg };
    }
    return {
      side, arrival,
      legs: [
        { name: 'Sobrevoo (identificação)', hdg: ovHdg, gs: gs(ovHdg),
          ref: arrival ? `UM à ${arrival.unitSide === 'dir' ? 'direita' : 'esquerda'}, pelo bordo do helideque · ler ICAO / cotejar` : 'Passagem abeam · ler código ICAO' },
        { name: 'Perna do vento',           hdg: dwHdg,    gs: gsDw,        ref: '1,0 NM de través · até 1,5–1,8 NM GPS' + (minAfterAbeam ? ` (~${minAfterAbeam} min após o través)` : '') },
        { name: 'Base',                     hdg: baseHdg,  gs: gs(baseHdg), ref: 'Curva 90° · bank ≤ 20° · compensar deriva' },
        { name: 'Final',                    hdg: finalHdg, gs: gs(finalHdg), ref: 'Deslocada — abeam o deck · no LDP, 45° p/ o pouso, trajetória contida no SLO e cauda livre' }
      ]
    };
  }

  /* ---------- avaliação e render ---------- */
  const el = {
    chip: $('statusChip'), alerts: $('alerts'),
    resFinal: $('resFinal'), resFinalSub: $('resFinalSub'),
    resWind: $('resWind'), resWindSub: $('resWindSub'),
    resClass: $('resClass'), resClassSub: $('resClassSub'),
    resCircuit: $('resCircuit'), resCircuitSub: $('resCircuitSub'),
    legsBody: $('legsBody'), gaText: $('gaText')
  };

  let lastResult = null;

  function evaluate(){
    const st = readState();
    const alerts = [];
    let status = 'warn', statusText = 'Aguardando briefing';
    let final = null, circuit = null, pf = null, cls = effectiveClass(st);

    const ready = st.sloBisector != null;
    if (ready){
      if (st.finalManual != null){
        const h = norm(st.finalManual);
        const dev = axisDev(h, st.sloBisector);
        const band = sloBand(h, st);
        const c = (st.windFrom != null && st.windKt)
          ? windComp(st.windFrom, st.windKt, h) : { head: 0, cross: 0 };
        final = { hdg: h, dev, head: c.head, cross: c.cross, manual: true, band };
        if (band === 'proibida')
          alerts.push({ t: 'bad', m: `Proa manual com chegada pelo setor de obstáculos — mais de 30° além dos limites laterais do SLO (45° do “H”). Descontinuar / novo circuito.` });
        else if (band === 'tolerada')
          alerts.push({ t: 'warn', m: `Proa manual além dos limites laterais do SLO (tolerância de 30° = 45° do “H”). Garantir o segmento pós-LDP integralmente dentro do SLO, cauda livre.` });
        if (Math.abs(c.cross) > st.xwindLimit)
          alerts.push({ t: 'bad', m: `Través de ${Math.abs(c.cross).toFixed(0)} kt acima do limite de ${st.xwindLimit} kt na proa manual.` });
      } else {
        final = suggestFinal(st);
        if (!final)
          alerts.push({ t: 'bad', m: `Nenhuma proa permitida pelo SLO fecha os limites de vento (través ≤ ${st.xwindLimit} kt e, acima de 10 kt de través, proa mínima de 5 kt). Aproximação inviável — reavaliar.` });
      }
    }

    if (final){
      pf = autoPfSide(st, final);
      circuit = buildCircuit(final.hdg, st, pf.side);
      if (final.head < -1)
        alerts.push({ t: 'warn', m: `Componente de vento de cauda na final (${Math.abs(final.head).toFixed(0)} kt). Reavaliar proa/perfil.` });
      if (Math.abs(final.cross) > 0.8 * st.xwindLimit && Math.abs(final.cross) <= st.xwindLimit)
        alerts.push({ t: 'warn', m: `Través de ${Math.abs(final.cross).toFixed(0)} kt — próximo do limite de ${st.xwindLimit} kt.` });
      if (violatesXwindRule(final))
        alerts.push({ t: 'bad', m: `Través de ${Math.abs(final.cross).toFixed(0)} kt (acima de 10 kt) exige pelo menos 5 kt de componente de proa — esta proa tem ${final.head.toFixed(0)} kt.` });
      else if (Math.abs(final.cross) > XWIND_HEADWIND_RULE.crossThresholdKt)
        alerts.push({ t: 'info', m: `Través de ${Math.abs(final.cross).toFixed(0)} kt (acima de 10 kt): exigência de ≥ 5 kt de proa atendida (${final.head.toFixed(0)} kt).` });
      if (final.band === 'tolerada' && !final.manual)
        alerts.push({ t: 'warn', m: `Final além dos limites laterais do SLO (tolerância de 30° = 45° do “H”) para manter o través nos limites — segmento pós-LDP integralmente dentro do SLO.` });
    }
    if (cls.changed)
      alerts.push({ t: 'info', m: `Vento de ${cls.sec}: helideque reclassificado de Classe ${st.deckClass} para Classe ${cls.cls}.` });

    const hasBad = alerts.some(a => a.t === 'bad');
    if (!ready){ status = 'warn'; statusText = 'Aguardando briefing'; }
    else if (hasBad){ status = 'bad'; statusText = 'Fora de limites'; }
    else if (alerts.some(a => a.t === 'warn')){ status = 'warn'; statusText = 'Briefing com ressalvas'; }
    else { status = 'ok'; statusText = 'Briefing OK'; }

    render(st, final, circuit, pf, cls, alerts, status, statusText);
    lastResult = { st, final, circuit, pf, cls, alerts, status, statusText };
    draw();
  }

  function render(st, final, circuit, pf, cls, alerts, status, statusText){
    el.chip.className = 'status-chip ' + status;
    el.chip.textContent = statusText;

    el.alerts.innerHTML = alerts.map(a => `<div class="alert ${a.t}">${a.m}</div>`).join('');

    // mostra o aproamento derivado (proa → UM; popa → recíproca) no próprio campo
    $('sloBisector').placeholder = st.bisAuto
      ? 'auto ' + fmtHdg(st.sloBisector) : 'auto (proa/popa da UM)';

    if (final){
      el.resFinal.textContent = fmtHdg(final.hdg);
      el.resFinalSub.textContent = (final.manual ? 'Proa manual · ' : final.intoWind ? 'Sugerida · aproada ao vento · ' : 'Sugerida · ') +
        `defasagem ${Math.abs(Math.round(final.dev || 0))}° do eixo do “H”` +
        (final.band === 'tolerada' ? ' · além dos limites — pós-LDP dentro do SLO'
         : final.band === 'proibida' ? ' · chegada pelo setor de obstáculos'
         : ' · chegada por dentro do SLO') +
        (st.sloAngle === 180 ? ' · SLO 180°' : '');
      el.resWind.innerHTML = st.windKt
        ? `${final.head >= 0 ? '▼' : '▲'} ${Math.abs(final.head).toFixed(0)} <span class="unit">kt proa</span> · ${Math.abs(final.cross).toFixed(0)} <span class="unit">kt través</span>`
        : 'Calmo';
      el.resWindSub.textContent = st.windKt
        ? `Vento ${fmtHdg(st.windFrom)} / ${st.windKt} kt · través ${final.cross >= 0 ? 'pela direita' : 'pela esquerda'} · limite ${st.xwindLimit} kt`
        : 'Sem vento informado.';
    } else {
      el.resFinal.textContent = '—';
      el.resFinalSub.textContent = st.sloBisector == null ? 'Informe o aproamento do helideque (ou aproamento da UM + posição proa/popa).' : 'Sem proa viável nos limites.';
      el.resWind.textContent = '—';
      el.resWindSub.textContent = 'Proa / través.';
    }

    el.resClass.textContent = `Classe ${cls.cls}`;
    el.resClassSub.textContent = cls.changed
      ? `Reclassificado (era Classe ${st.deckClass}) — vento de ${cls.sec}.`
      : (cls.sec ? `Vento de ${cls.sec} — sem reclassificação.` : 'Sem dados de vento/aproamento.');

    renderDeckWx(cls);

    if (circuit){
      el.resCircuit.textContent = circuit.side === 'esq' ? 'Curvas à esquerda' : 'Curvas à direita';
      el.resCircuitSub.textContent = circuit.arrival
        ? `PF no assento ${pf.side === 'esq' ? 'esquerdo' : 'direito'} — passagem ${fmtHdg(circuit.arrival.hdg)} deixando a UM à ${circuit.arrival.unitSide === 'dir' ? 'direita' : 'esquerda'} (bordo do helideque): identificação pelo piloto do assento ${circuit.arrival.unitSide === 'dir' ? 'direito' : 'esquerdo'}. Após a passagem, proa ${fmtHdg(circuit.arrival.entryHdg)} para interceptar a perna do vento a 90°.` +
          (circuit.arrival.unitSide !== pf.side ? ' Avaliar troca PF/PM.' : '')
        : `PF no assento ${pf.side === 'esq' ? 'esquerdo' : 'direito'} — deck abeam pelo lado do PF; sentido da final escolhido pelo vento. Avaliar troca PF/PM após o sobrevoo.`;
      el.legsBody.innerHTML = circuit.legs.map(l =>
        `<tr><td>${l.name}</td><td class="hdg">${fmtHdg(l.hdg)}</td><td>${l.gs} kt</td><td class="dim">${l.ref}</td></tr>`).join('');
      el.gaText.textContent = 'Antes do LDP: RETO EM FRENTE, no prolongamento da final deslocada — escape livre dentro do SLO. No LDP: trajetória integralmente dentro do SLO, cauda livre de obstáculos — senão, descontinuar. Após o LDP: pousar.';
    } else {
      el.resCircuit.textContent = '—';
      el.resCircuitSub.textContent = 'Lado das curvas · PF.';
      el.legsBody.innerHTML = '<tr><td colspan="4" class="dim">Preencha os dados para montar o circuito.</td></tr>';
      el.gaText.textContent = '—';
    }
  }

  /* ---------- desenho (canvas, north-up) ---------- */
  const viz = $('vizCanvas'), fsCanvas = $('fsCanvas');

  function vec(bearing){ return { e: Math.sin(rad(bearing)), n: Math.cos(rad(bearing)) }; }
  function pAdd(p, v, k){ return { e: p.e + v.e * k, n: p.n + v.n * k }; }

  function circuitPoints(finalHdg, side){
    const f = vec(finalHdg);
    const offBear = norm(finalHdg + (side === 'esq' ? -90 : 90));
    const o = vec(offBear);
    const D = { e: 0, n: 0 };
    // final deslocada: trilha passa abeam o deck, com o deck pelo lado do PF
    const OFF = 0.16;
    const abeam = pAdd(D, o, -OFF);            // ponto imaginário ao lado do helideque
    const ldp = pAdd(abeam, f, -OFF);          // deck a 45° do LDP
    return {
      f, o, D, abeam, ldp,
      finalStart: pAdd(abeam, f, -1.35),
      escEnd:  pAdd(abeam, f, 1.1),            // escape reto em frente
      dwStart: pAdd(pAdd(D, o, 1.0), f, 1.0),
      dwTurn:  pAdd(pAdd(D, o, 1.0), f, -1.25),
      c1:      pAdd(pAdd(D, o, 1.0), f, -1.62),
      baseMid: pAdd(pAdd(D, o, 0.5), f, -1.62),
      c2:      pAdd(abeam, f, -1.62),
      ovEnd:   pAdd(D, f, 0.95),
      ovC:     pAdd(D, f, 1.45),
      ovC2:    pAdd(pAdd(D, o, 1.0), f, 1.45)
    };
  }

  function draw(){
    drawOn(viz, viz.parentElement.clientWidth, Math.max(360, Math.min(560, window.innerHeight * 0.6)));
    if (!fsOverlay.hidden){
      drawOn(fsCanvas, fsCanvas.clientWidth, fsCanvas.clientHeight);
    }
  }

  function drawOn(canvas, cssW, cssH){
    if (!cssW || !cssH) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const r = lastResult;
    ctx.fillStyle = '#081120';
    ctx.fillRect(0, 0, cssW, cssH);

    // bússola
    ctx.save();
    ctx.fillStyle = 'rgba(157,176,196,.8)';
    ctx.font = '700 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', cssW - 24, 22);
    ctx.strokeStyle = 'rgba(157,176,196,.8)';
    ctx.beginPath(); ctx.moveTo(cssW - 24, 40); ctx.lineTo(cssW - 24, 27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cssW - 28, 31); ctx.lineTo(cssW - 24, 25); ctx.lineTo(cssW - 20, 31); ctx.fill();
    ctx.restore();

    if (!r || !r.st || r.st.sloBisector == null){
      ctx.fillStyle = 'rgba(157,176,196,.6)';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Informe o aproamento do helideque (ou da UM + posição) para desenhar.', cssW / 2, cssH / 2);
      return;
    }

    const st = r.st;
    const finalHdg = r.final ? r.final.hdg : norm(st.sloBisector + 90);
    const side = r.circuit ? r.circuit.side : 'dir';
    const P = circuitPoints(finalHdg, side);

    // enquadramento (inclui posições dos rótulos para nada ficar cortado)
    // pontos do sobrevoo de reconhecimento (quando a proa de chegada é informada)
    if (st.arrivalHdg != null && r.circuit && r.circuit.arrival){
      const arr = r.circuit.arrival;
      const av = vec(arr.hdg);
      const ao = vec(arr.passBear); // deslocamento p/ o bordo do helideque (mar)
      const eo = vec(arr.entryHdg);
      P.arrAbeam = pAdd(P.D, ao, 0.3);
      P.arrStart = pAdd(P.arrAbeam, av, -2.0);
      P.arrEnd = pAdd(P.arrAbeam, av, 0.9);
      // curva p/ a proa de entrada e interceptação da perna do vento a 90°
      P.entryTurn = pAdd(pAdd(P.arrEnd, av, 0.45), eo, 0.45);
      const s = 1.0 - ((P.entryTurn.e - P.D.e) * P.o.e + (P.entryTurn.n - P.D.n) * P.o.n);
      P.entryJoin = pAdd(P.entryTurn, eo, Math.max(0.15, s));
      P.entryEnd = pAdd(P.entryJoin, P.f, -0.4); // segue na perna do vento
    }
    const pts = [P.finalStart, P.abeam, P.ldp, P.escEnd, P.dwStart, P.dwTurn, P.c1, P.baseMid, P.c2, P.ovEnd, P.ovC, P.ovC2, P.D,
                 ...(P.arrStart ? [P.arrStart, P.arrEnd, P.entryTurn, P.entryJoin, P.entryEnd,
                                   pAdd(P.arrStart, vec(norm(st.arrivalHdg)), -0.45)] : []),
                 pAdd(pAdd(P.D, P.o, 1.3), P.f, 0.4),
                 pAdd(pAdd(P.D, P.o, 0.5), P.f, -2.0),
                 pAdd(P.finalStart, P.f, -0.4),
                 { e: 0.7, n: 0.7 }, { e: -0.7, n: -0.7 }];
    let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
    pts.forEach(p => { minE = Math.min(minE, p.e); maxE = Math.max(maxE, p.e); minN = Math.min(minN, p.n); maxN = Math.max(maxN, p.n); });
    const pad = 46;
    const scale = Math.min((cssW - pad * 2) / (maxE - minE), (cssH - pad * 2) / (maxN - minN));
    const cx = (minE + maxE) / 2, cy = (minN + maxN) / 2;
    const X = p => cssW / 2 + (p.e - cx) * scale;
    const Y = p => cssH / 2 - (p.n - cy) * scale;

    // anéis de distância 1 e 2 NM
    ctx.strokeStyle = 'rgba(148,163,184,.12)';
    ctx.setLineDash([4, 6]);
    [1, 2].forEach(nm => {
      ctx.beginPath(); ctx.arc(X(P.D), Y(P.D), nm * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,.35)';
      ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(nm + ' NM', X(P.D) + nm * scale + 4, Y(P.D));
    });
    ctx.setLineDash([]);

    // SLO — setor livre a partir do helideque, aberto para o lado da aproximação
    const bis = st.sloBisector;
    const half = st.sloAngle / 2;
    const outBear = norm(bis); // SLO voltado para o mar — a aeronave vem deste lado
    const sloR = 0.62 * scale;
    const a0 = rad(norm(outBear - half) - 90), a1 = rad(norm(outBear + half) - 90);
    ctx.beginPath();
    ctx.moveTo(X(P.D), Y(P.D));
    ctx.arc(X(P.D), Y(P.D), sloR, a0, a1, false);
    ctx.closePath();
    ctx.fillStyle = 'rgba(90,209,154,.13)';
    ctx.strokeStyle = 'rgba(90,209,154,.45)';
    ctx.fill(); ctx.stroke();
    // bissetriz
    const bv = vec(outBear);
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(90,209,154,.5)';
    ctx.beginPath();
    ctx.moveTo(X(P.D), Y(P.D));
    ctx.lineTo(X(P.D) + bv.e * sloR, Y(P.D) - bv.n * sloR);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(90,209,154,.8)';
    ctx.font = '700 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SLO ' + st.sloAngle + '°', X(P.D) + bv.e * (sloR + 16), Y(P.D) - bv.n * (sloR + 16));

    // faixas de tolerância (30° além dos limites) e setor proibido —
    // desenhadas somente quando a final as utiliza
    if (r.final && r.final.band !== 'dentro'){
      const wedge = (b1, b2, fill, stroke) => {
        ctx.beginPath();
        ctx.moveTo(X(P.D), Y(P.D));
        ctx.arc(X(P.D), Y(P.D), sloR, rad(norm(b1) - 90), rad(norm(b2) - 90), false);
        ctx.closePath();
        ctx.fillStyle = fill; ctx.strokeStyle = stroke;
        ctx.fill(); ctx.stroke();
      };
      const yF = 'rgba(232,184,75,.13)', yS = 'rgba(232,184,75,.45)';
      if (r.final.band === 'tolerada'){
        // faixa amarela do lado por onde a final chega
        const s = angDiff(norm(r.final.hdg + 180), bis) >= 0 ? 1 : -1;
        if (s > 0) wedge(bis + half, bis + half + 30, yF, yS);
        else wedge(bis - half - 30, bis - half, yF, yS);
      } else {
        // fora de qualquer tolerância: mostra as duas faixas e o setor proibido
        wedge(bis + half, bis + half + 30, yF, yS);
        wedge(bis - half - 30, bis - half, yF, yS);
        wedge(bis + half + 30, bis + 360 - half - 30, 'rgba(255,107,107,.15)', 'rgba(255,107,107,.5)');
      }
    }

    // navio (fora de escala)
    if (st.shipHeading != null){
      const sv = vec(st.shipHeading);
      let sternK = -0.5, bowK = 0.1; // helideque na popa: navio se estende para a proa
      if (st.deckPos === 'proa'){ sternK = -0.1; bowK = 0.5; }
      if (st.deckPos === 'meia-nau' || st.deckPos === 'deslocado'){ sternK = -0.3; bowK = 0.3; }
      // hull: do deck em direção à proa do navio
      const stern = pAdd(P.D, sv, st.deckPos === 'proa' ? -0.55 : (st.deckPos === 'popa' ? 0.06 : -0.3));
      const bow = pAdd(P.D, sv, st.deckPos === 'proa' ? 0.06 : (st.deckPos === 'popa' ? 0.55 : 0.3));
      const pv = vec(norm(st.shipHeading + 90));
      const wHalf = 0.055;
      ctx.beginPath();
      ctx.moveTo(X(pAdd(stern, pv, -wHalf)), Y(pAdd(stern, pv, -wHalf)));
      ctx.lineTo(X(pAdd(bow, pv, -wHalf)), Y(pAdd(bow, pv, -wHalf)));
      ctx.lineTo(X(pAdd(bow, sv, 0.08)), Y(pAdd(bow, sv, 0.08))); // bico de proa
      ctx.lineTo(X(pAdd(bow, pv, wHalf)), Y(pAdd(bow, pv, wHalf)));
      ctx.lineTo(X(pAdd(stern, pv, wHalf)), Y(pAdd(stern, pv, wHalf)));
      ctx.closePath();
      ctx.fillStyle = 'rgba(36,52,71,.85)';
      ctx.strokeStyle = 'rgba(148,163,184,.35)';
      ctx.fill(); ctx.stroke();
    }

    // helideque + "H"
    ctx.beginPath();
    ctx.arc(X(P.D), Y(P.D), Math.max(9, 0.075 * scale), 0, Math.PI * 2);
    ctx.fillStyle = '#0f6b46';
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.save();
    ctx.translate(X(P.D), Y(P.D));
    ctx.rotate(rad(norm(st.sloBisector + 90))); // eixo do "H" perpendicular à bissetriz
    ctx.fillStyle = '#fff';
    ctx.font = '800 ' + Math.max(10, 0.08 * scale) + 'px Inter, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', 0, 0);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';

    // circuito
    if (r.final){
      ctx.strokeStyle = 'rgba(70,194,186,.95)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(X(P.dwStart), Y(P.dwStart));
      ctx.lineTo(X(P.dwTurn), Y(P.dwTurn));
      ctx.quadraticCurveTo(X(P.c1), Y(P.c1), X(P.baseMid), Y(P.baseMid));
      ctx.quadraticCurveTo(X(P.c2), Y(P.c2), X(P.finalStart), Y(P.finalStart));
      ctx.lineTo(X(P.ldp), Y(P.ldp));
      ctx.lineTo(X(P.D), Y(P.D)); // deslocamento de 45° do LDP para o pouso
      ctx.stroke();

      // escape reto em frente (arremetida antes do LDP)
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(232,184,75,.75)';
      ctx.beginPath();
      ctx.moveTo(X(P.ldp), Y(P.ldp));
      ctx.lineTo(X(P.escEnd), Y(P.escEnd));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.save();
      ctx.translate(X(P.escEnd), Y(P.escEnd));
      ctx.rotate(rad(finalHdg));
      ctx.fillStyle = 'rgba(232,184,75,.85)';
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5);
      ctx.closePath(); ctx.fill();
      ctx.restore();

      // LDP
      ctx.beginPath();
      ctx.arc(X(P.ldp), Y(P.ldp), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#e8b84b';
      ctx.fill();

      // sobrevoo de reconhecimento -> perna do vento (tracejado)
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(70,194,186,.5)';
      ctx.beginPath();
      if (st.arrivalHdg != null && r.circuit.arrival){
        // chegada pelo bordo do helideque; entrada perpendicular na perna do vento
        const arr = r.circuit.arrival;
        const ah = arr.hdg;
        const av = vec(ah);
        const ao = vec(arr.passBear);
        const abeamId = P.arrAbeam; // través da UM — identificação
        ctx.moveTo(X(P.arrStart), Y(P.arrStart));
        ctx.lineTo(X(P.arrEnd), Y(P.arrEnd));
        ctx.quadraticCurveTo(X(pAdd(P.arrEnd, av, 0.45)), Y(pAdd(P.arrEnd, av, 0.45)), X(P.entryTurn), Y(P.entryTurn));
        ctx.lineTo(X(pAdd(P.entryJoin, vec(arr.entryHdg), -0.3)), Y(pAdd(P.entryJoin, vec(arr.entryHdg), -0.3)));
        ctx.quadraticCurveTo(X(P.entryJoin), Y(P.entryJoin), X(P.entryEnd), Y(P.entryEnd));
        ctx.stroke();
        // proa de entrada
        ctx.fillStyle = 'rgba(70,194,186,.75)';
        ctx.font = '700 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        const entryMid = pAdd(P.entryTurn, vec(arr.entryHdg), 0.45);
        ctx.fillText(fmtHdg(arr.entryHdg), X(entryMid) + 16, Y(entryMid) - 6);
        ctx.setLineDash([]);
        // seta e rótulos da chegada
        ctx.save();
        ctx.translate(X(pAdd(abeamId, av, -1.0)), Y(pAdd(abeamId, av, -1.0)));
        ctx.rotate(rad(ah));
        ctx.fillStyle = 'rgba(70,194,186,.7)';
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(229,238,248,.85)';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Chegada ' + fmtHdg(ah), X(pAdd(P.arrStart, av, -0.22)), Y(pAdd(P.arrStart, av, -0.22)));
        ctx.beginPath();
        ctx.arc(X(abeamId), Y(abeamId), 3.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(70,194,186,.9)';
        ctx.fill();
        ctx.fillStyle = 'rgba(70,194,186,.9)';
        ctx.font = '700 10px Inter, sans-serif';
        const idLbl = pAdd(pAdd(abeamId, ao, 0.05), av, -0.38);
        ctx.fillText('ID — ' + (r.circuit.arrival.unitSide === 'dir' ? 'piloto dir.' : 'piloto esq.'), X(idLbl), Y(idLbl));
      } else {
        ctx.moveTo(X(pAdd(P.D, P.f, -0.35)), Y(pAdd(P.D, P.f, -0.35)));
        ctx.lineTo(X(P.ovEnd), Y(P.ovEnd));
        ctx.quadraticCurveTo(X(P.ovC), Y(P.ovC), X(pAdd(P.ovC2, P.f, -0.2)), Y(pAdd(P.ovC2, P.f, -0.2)));
        ctx.lineTo(X(P.dwStart), Y(P.dwStart));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1;

      // setas de sentido
      const arrow = (p, bearing) => {
        ctx.save();
        ctx.translate(X(p), Y(p));
        ctx.rotate(rad(bearing));
        ctx.fillStyle = 'rgba(70,194,186,.95)';
        ctx.beginPath();
        ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(-5, 5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      };
      const dwHdg = norm(finalHdg + 180);
      arrow(pAdd(pAdd(P.D, P.o, 1.0), P.f, -0.2), dwHdg);
      arrow(pAdd(P.finalStart, P.f, 0.5), finalHdg);

      // rótulos
      const label = (p, txt, color) => {
        ctx.fillStyle = color || 'rgba(229,238,248,.9)';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(txt, X(p), Y(p));
      };
      label(pAdd(pAdd(P.D, P.o, 1.14), P.f, 0.25), 'Vento ' + fmtHdg(dwHdg));
      label(pAdd(pAdd(P.D, P.o, 0.5), P.f, -1.85), 'Base 1,5–1,8 NM');
      label(pAdd(P.finalStart, P.f, -0.22), 'Final ' + fmtHdg(finalHdg));
      label(pAdd(P.ldp, P.o, -0.24), 'LDP', '#e8b84b');
      label(pAdd(P.escEnd, P.f, 0.22), 'Escape', 'rgba(232,184,75,.85)');
      label(pAdd(pAdd(P.D, P.o, 0.55), P.f, -0.12), '1,0 NM', 'rgba(157,176,196,.8)');
      // linha do través
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(157,176,196,.35)';
      ctx.beginPath();
      ctx.moveTo(X(P.D), Y(P.D));
      ctx.lineTo(X(pAdd(P.D, P.o, 1.0)), Y(pAdd(P.D, P.o, 1.0)));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // vento
    if (st.windFrom != null && st.windKt){
      const wv = vec(norm(st.windFrom + 180)); // direção para onde sopra
      const wx = 56, wy = 46;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.strokeStyle = '#e8b84b';
      ctx.fillStyle = '#e8b84b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-wv.e * 18, wv.n * 18);
      ctx.lineTo(wv.e * 18, -wv.n * 18);
      ctx.stroke();
      ctx.save();
      ctx.rotate(rad(norm(st.windFrom + 180)));
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(5, -12); ctx.lineTo(-5, -12);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
      ctx.fillStyle = '#e8b84b';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Vento ${fmtHdg(st.windFrom)} / ${st.windKt} kt`, 30, 88);
      ctx.lineWidth = 1;
    }

    // parâmetros fixos
    ctx.fillStyle = 'rgba(157,176,196,.75)';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Circuito: 500 ft RADALT · 80 KIAS', 12, cssH - 14);
    ctx.fillStyle = 'rgba(157,176,196,.45)';
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Fora de escala — apenas orientação espacial', cssW - 10, cssH - 14);
  }

  /* ---------- integração com o módulo Pesos (contexto compartilhado) ---------- */
  const DECK_LIMITS_DAY = {
    '1': { rollPitchDeg: 4, incDeg: 4.5, heaveRateMs: 1.3, heaveM: 5.0 },
    '2': { rollPitchDeg: 3, incDeg: 3.5, heaveRateMs: 1.0, heaveM: 3.0 },
    '3': { rollPitchDeg: 3, incDeg: 3.5, heaveRateMs: 1.0, heaveM: 3.0 }
  };

  let pesoWx = null;      // weather importado do módulo Pesos (perna crítica ou chip clicado)
  let pesoWxLabel = null; // destino/UM a que esse weather se refere

  function loadSharedCtx(){
    try { return JSON.parse(localStorage.getItem(CTX_KEY) || '{}'); } catch (e) { return {}; }
  }

  function pesoCriticalLeg(ctx){
    const list = ctx.pesoWeatherPorPerna;
    if (!Array.isArray(list) || !list.length) return null;
    const idx = ctx.pesoPernaCritica != null ? ctx.pesoPernaCritica - 1 : 0;
    return list[idx] || list[0];
  }

  function setFieldIfEmpty(id, val){
    const node = $(id);
    if (!node || val == null || val === '' || node.value) return;
    node.value = val;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /* preenchimento explícito (clique no chip da rota) sobrescreve o campo */
  function setFieldForce(id, val){
    const node = $(id);
    if (!node || val == null || val === '') return;
    node.value = val;
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyPesoLeg(leg, force){
    const wx = leg && leg.weather;
    if (!wx || wx.type !== 'um') return;
    pesoWx = wx;
    pesoWxLabel = leg.destino || null;
    const set = force ? setFieldForce : setFieldIfEmpty;
    set('umIcao', leg.destino);
    set('shipHeading', num(wx.aproamento));
    if (wx.vento){
      const parts = String(wx.vento).split('/');
      set('windFrom', num(parts[0]));
      set('windKt', num(parts[1]));
    }
    if (force) evaluate();
  }

  // Chips com as UMs da rota do Pesos: clicar importa o deque daquela
  // localidade (o wx de cada perna no Pesos é o do destino/pouso).
  function addPesoRouteChips(ctx){
    const legs = ctx.pesoPernas || ctx.pesoWeatherPorPerna;
    const umLegs = Array.isArray(legs) ? legs.filter(l => l.weather && l.weather.type === 'um') : [];
    const form = document.querySelector('.entry-panel form');
    if (!form) return;
    const strip = document.createElement('div');
    strip.id = 'pesoRouteChips';
    // Sem dados, vira um aviso do que falta — dá para ver que a integração
    // está ativa e o motivo de não haver chips.
    const hint = !Array.isArray(legs) || !legs.length
      ? '<span class="chips-hint">Sem voo publicado — calcule a rota no Planejamento do Voo.</span>'
      : '<span class="chips-hint">Preencha o WX das UMs no Planejamento do Voo para importar.</span>';
    strip.innerHTML = '<span class="chips-label">Helideques da rota (Voo)</span>' +
      (umLegs.length
        ? umLegs.map(l => `<button type="button" data-perna="${l.perna}" title="Perna ${l.perna} — pouso em ${l.destino}">${l.destino}</button>`).join('')
        : hint);
    strip.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-perna]');
      if (!btn) return;
      const leg = umLegs.find(l => String(l.perna) === btn.dataset.perna);
      if (!leg) return;
      applyPesoLeg(leg, true);
      strip.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    });
    form.parentElement.insertBefore(strip, form);
  }

  // Preenche uma única vez, no carregamento, os campos ainda vazios com os
  // dados de weather da perna crítica calculada pelo módulo Pesos, e monta
  // os chips de importação por localidade.
  function importFromPesosOnce(){
    const ctx = loadSharedCtx();
    addPesoRouteChips(ctx);
    const leg = pesoCriticalLeg(ctx);
    const wx = leg && leg.weather;
    pesoWx = wx || null;
    if (!wx || wx.type !== 'um') return;
    applyPesoLeg(leg, false);
  }

  function renderDeckWx(cls){
    const box = $('deckWxPanel');
    if (!box) return;
    if (!pesoWx || pesoWx.type !== 'um'){ box.hidden = true; return; }
    box.hidden = false;
    const lim = DECK_LIMITS_DAY[cls.cls] || DECK_LIMITS_DAY['3'];
    const rows = [
      ['Pitch', pesoWx.pitch, '°', lim.rollPitchDeg],
      ['Roll', pesoWx.roll, '°', lim.rollPitchDeg],
      ['Heave', pesoWx.heave, 'm', lim.heaveM],
      ['Heave rate', pesoWx.heaveRate, 'm/s', lim.heaveRateMs],
      ['Inclinação', pesoWx.inclinacao, '°', lim.incDeg]
    ];
    const title = box.querySelector('.deck-wx-title');
    if (title) title.textContent = 'Movimento do deque — ' + (pesoWxLabel ? pesoWxLabel + ' · ' : '') + 'via Planejamento do Voo';
    const overLimit = [];
    box.querySelector('.deck-wx-grid').innerHTML = rows.map(([label, val, unit, max]) => {
      const n = num(val);
      const over = n != null && Math.abs(n) > max;
      if (over) overLimit.push(label);
      const shown = (val != null && val !== '') ? String(val).replace('.', ',') + ' ' + unit : '—';
      return `<div class="deck-wx-item${over ? ' over' : ''}"><span class="deck-wx-label">${label}</span><span class="deck-wx-val">${shown}</span></div>`;
    }).join('');
    const statusBad = pesoWx.statusLight === 'vermelho' || pesoWx.helideckOk === 'nao';
    const notes = [];
    if (statusBad) notes.push('Status Light vermelha / helideque não guarnecido e liberado — arremetida obrigatória.');
    if (overLimit.length) notes.push(`Fora do limite diurno da Classe ${cls.cls}: ${overLimit.join(', ')}.`);
    if (!notes.length) notes.push(`Dentro dos limites diurnos da Classe ${cls.cls}.`);
    box.querySelector('.deck-wx-note').textContent = notes.join(' ');
    box.classList.toggle('deck-wx-alert', statusBad || overLimit.length > 0);
  }

  /* ---------- contexto compartilhado (integração futura) ---------- */
  function saveSharedContext(){
    if (!lastResult || !lastResult.final) return;
    try {
      const prev = JSON.parse(localStorage.getItem(CTX_KEY) || '{}');
      const r = lastResult;
      localStorage.setItem(CTX_KEY, JSON.stringify({
        ...prev,
        circuitoFinalHeading: Math.round(r.final.hdg),
        circuitoLado: r.circuit ? r.circuit.side : null,
        circuitoHeadwindKt: Math.round(r.final.head),
        circuitoCrosswindKt: Math.round(r.final.cross),
        circuitoUmIcao: r.st.umIcao || null,
        updatedAt: new Date().toISOString(),
        lastModule: 'slo'
      }));
    } catch (e) { /* localStorage indisponível */ }
  }

  function saveForm(){
    try {
      const data = {};
      FIELDS.forEach(id => { data[id] = $(id).value; });
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {}
  }
  function loadForm(){
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      FIELDS.forEach(id => { if (data[id] != null && data[id] !== '') $(id).value = data[id]; });
    } catch (e) {}
  }

  /* ---------- PDF (impressão) ---------- */
  function sharePdf(){
    const r = lastResult;
    const area = $('printArea');
    if (!r || !r.final){
      alert('Monte o briefing antes de gerar o PDF.');
      return;
    }
    const img = viz.toDataURL('image/png');
    const st = r.st;
    area.innerHTML = `
      <h1>Briefing — Circuito Offshore Diurno${st.umIcao ? ' · ' + st.umIcao : ''}</h1>
      <div class="p-sub">Classe efetiva ${r.cls.cls}${r.cls.changed ? ' (reclassificada)' : ''} ·
        SLO ${st.sloAngle}° · Helideque ${fmtHdg(st.sloBisector)} · Vento ${st.windKt ? fmtHdg(st.windFrom) + ' / ' + st.windKt + ' kt' : 'calmo'}</div>
      <div class="p-flags">${r.statusText}${r.alerts.length ? ' — ' + r.alerts.map(a => a.m).join(' | ') : ''}</div>
      <table>
        <tr><th>Perna</th><th>Proa</th><th>GS est.</th><th>Referência</th></tr>
        ${r.circuit.legs.map(l => `<tr><td>${l.name}</td><td>${fmtHdg(l.hdg)}</td><td>${l.gs} kt</td><td>${l.ref}</td></tr>`).join('')}
      </table>
      <ul>
        <li>Vento na final: ${Math.abs(r.final.head).toFixed(0)} kt de ${r.final.head >= 0 ? 'proa' : 'cauda'} ·
            ${Math.abs(r.final.cross).toFixed(0)} kt de través (limite ${st.xwindLimit} kt)</li>
        <li>Circuito: curvas à ${r.circuit.side === 'esq' ? 'esquerda' : 'direita'} · 500 ft RADALT · 80 KIAS</li>
        <li>Arremetida antes do LDP: reto em frente, no prolongamento da final deslocada — reiterar na perna do vento</li>
        <li>PF no assento ${r.circuit.side === 'esq' ? 'esquerdo' : 'direito'} — deck pelo lado do PF</li>
        <li>Estabilizada antes de 0,5 NM · final 75–85 kt · descida ≤500 ft/min abaixo de 500 ft · ≤350 ft/min no segmento final</li>
      </ul>
      <img src="${img}" alt="Diagrama do circuito">
      <div class="p-foot">Ferramenta pessoal de estudo e briefing — não substitui SOP, MGO ou RFM.</div>`;
    window.print();
  }

  /* ---------- fullscreen ---------- */
  const fsOverlay = $('fsOverlay');
  $('fsOpen').addEventListener('click', () => {
    fsOverlay.hidden = false;
    requestAnimationFrame(draw);
  });
  $('fsClose').addEventListener('click', () => { fsOverlay.hidden = true; });

  /* ---------- eventos ---------- */
  FIELDS.forEach(id => {
    const node = $(id);
    node.addEventListener('input', () => { evaluate(); saveForm(); });
    node.addEventListener('change', () => { evaluate(); saveForm(); });
  });

  $('runBtn').addEventListener('click', () => {
    evaluate();
    saveSharedContext();
    const panel = $('resultPanel');
    panel.classList.remove('pending');
    if (window.innerWidth < 980) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('pdfBtn').addEventListener('click', sharePdf);

  $('resetBtn').addEventListener('click', () => {
    FIELDS.forEach(id => {
      const node = $(id);
      if (node.tagName === 'SELECT') node.selectedIndex = id === 'deckPos' ? 1 : 0;
      else node.value = id === 'xwindLimit' ? '20' : '';
    });
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    evaluate();
  });

  /* query params da suíte: embed / back / return */
  const params = new URLSearchParams(location.search);
  if (params.get('embed') === '1') document.body.classList.add('embed');
  if (params.has('back') || params.has('return')){
    const back = $('backBtn');
    back.hidden = false;
    document.body.classList.add('has-back-btn');
    back.addEventListener('click', (e) => {
      e.preventDefault();
      const ret = params.get('return');
      if (ret) location.href = ret;
      else if (history.length > 1) history.back();
    });
  }

  window.addEventListener('resize', draw);

  /* ---------- service worker (uso standalone offline) ---------- */
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  loadForm();
  // migra o default antigo salvo (35 kt) para o limite real do AW139
  if ($('xwindLimit').value === '35') $('xwindLimit').value = '20';
  importFromPesosOnce();
  evaluate();
})();
