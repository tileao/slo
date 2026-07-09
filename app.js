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
  const FIELDS = ['umIcao','deckClass','deckPos','shipHeading','hOrientation','sloAngle',
                  'sloBisector','finalManual','windFrom','windKt','xwindLimit'];

  function readState(){
    const H = num($('hOrientation').value);
    const bis = num($('sloBisector').value);
    return {
      umIcao: ($('umIcao').value || '').trim().toUpperCase(),
      deckClass: $('deckClass').value,
      deckPos: $('deckPos').value,
      shipHeading: num($('shipHeading').value),
      H,
      sloAngle: Number($('sloAngle').value),
      sloBisector: bis != null ? norm(bis) : (H != null ? norm(H) : null),
      finalManual: num($('finalManual').value),
      windFrom: num($('windFrom').value),
      windKt: num($('windKt').value) ?? 0,
      xwindLimit: num($('xwindLimit').value) ?? 35
    };
  }

  /* ---------- lógica operacional ---------- */

  /* proa final sugerida: alinhada ao "H", defasagem máx. 45°, través dentro do limite,
     privilegiando componente de vento de proa */
  function suggestFinal(st){
    if (st.H == null) return null;
    if (st.windFrom == null || !st.windKt){
      return { hdg: norm(st.H), dev: 0, head: 0, cross: 0, calm: true };
    }
    let best = null;
    for (let dev = -45; dev <= 45; dev++){
      const h = norm(st.H + dev);
      const c = windComp(st.windFrom, st.windKt, h);
      if (Math.abs(c.cross) > st.xwindLimit) continue;
      // favorece vento de proa; pequena penalidade por defasagem do H
      const score = c.head - 0.2 * Math.abs(dev);
      if (!best || score > best.score) best = { hdg: h, dev, head: c.head, cross: c.cross, score };
    }
    return best; // null => inviável dentro dos limites
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

  /* lado do PF (= lado do deck na final deslocada), automático:
     - final defasada além do prolongamento dos limites laterais do SLO
       (±15° da bissetriz no SLO 210°): a geometria força o deck para o lado
       oposto à defasagem, mantendo a final deslocada e o escape dentro do setor;
     - dentro do prolongamento: deck pelo lado de onde vem o través, para que o
       deslocamento no LDP seja contra o vento e o escape derive para longe da UM;
     - vento calmo/alinhado: assento direito (perfil normal do RFM). */
  function autoPfSide(st, final){
    const bis = st.sloBisector != null ? st.sloBisector : norm(st.H);
    const win = Math.max(0, st.sloAngle / 2 - 90);
    const dBis = angDiff(final.hdg, bis);
    if (dBis > win) return { side: 'esq', why: 'slo' };
    if (dBis < -win) return { side: 'dir', why: 'slo' };
    if (Math.abs(final.cross) > 2) return { side: final.cross > 0 ? 'dir' : 'esq', why: 'vento' };
    return { side: 'dir', why: 'padrao' };
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
    return {
      side,
      legs: [
        { name: 'Sobrevoo (identificação)', hdg: finalHdg, gs: gs(finalHdg), ref: 'Vertical da UM · ler código ICAO' },
        { name: 'Perna do vento',           hdg: dwHdg,    gs: gsDw,        ref: '1,0 NM de través · até 1,5–1,8 NM GPS' + (minAfterAbeam ? ` (~${minAfterAbeam} min após o través)` : '') },
        { name: 'Base',                     hdg: baseHdg,  gs: gs(baseHdg), ref: 'Curva 90° · bank ≤ 20° · compensar deriva' },
        { name: 'Final',                    hdg: finalHdg, gs: gs(finalHdg), ref: 'Deslocada — ponto imaginário abeam o deck · no LDP, 45° p/ o pouso' }
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

    const ready = st.H != null;
    if (ready){
      if (st.finalManual != null){
        const h = norm(st.finalManual);
        const dev = angDiff(h, st.H);
        const c = (st.windFrom != null && st.windKt)
          ? windComp(st.windFrom, st.windKt, h) : { head: 0, cross: 0 };
        final = { hdg: h, dev, head: c.head, cross: c.cross, manual: true };
        if (Math.abs(dev) > 45)
          alerts.push({ t: 'bad', m: `Proa manual com defasagem de ${Math.abs(Math.round(dev))}° do “H” — acima de 45°. Fora dos limites: descontinuar / novo circuito.` });
        if (Math.abs(c.cross) > st.xwindLimit)
          alerts.push({ t: 'bad', m: `Través de ${Math.abs(c.cross).toFixed(0)} kt acima do limite de ${st.xwindLimit} kt na proa manual.` });
      } else {
        final = suggestFinal(st);
        if (!final)
          alerts.push({ t: 'bad', m: `Nenhuma proa com defasagem ≤ 45° do “H” mantém o través dentro de ${st.xwindLimit} kt. Aproximação inviável — reavaliar.` });
      }
    }

    if (final){
      pf = autoPfSide(st, final);
      circuit = buildCircuit(final.hdg, st, pf.side);
      if (final.head < -1)
        alerts.push({ t: 'warn', m: `Componente de vento de cauda na final (${Math.abs(final.head).toFixed(0)} kt). Reavaliar proa/perfil.` });
      if (Math.abs(final.cross) > 0.8 * st.xwindLimit && Math.abs(final.cross) <= st.xwindLimit)
        alerts.push({ t: 'warn', m: `Través de ${Math.abs(final.cross).toFixed(0)} kt — próximo do limite de ${st.xwindLimit} kt.` });
      if (Math.abs(final.dev) > 0 && !final.manual)
        alerts.push({ t: 'info', m: `Final defasada ${Math.abs(Math.round(final.dev))}° ${final.dev > 0 ? 'à direita' : 'à esquerda'} do “H” para reduzir o través.` });
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

    if (final){
      el.resFinal.textContent = fmtHdg(final.hdg);
      el.resFinalSub.textContent = (final.manual ? 'Proa manual · ' : 'Sugerida · ') +
        `defasagem ${Math.abs(Math.round(final.dev || 0))}° do “H”` +
        (st.sloAngle === 180 ? ' · SLO 180°' : '');
      el.resWind.innerHTML = st.windKt
        ? `${final.head >= 0 ? '▼' : '▲'} ${Math.abs(final.head).toFixed(0)} <span class="unit">kt proa</span> · ${Math.abs(final.cross).toFixed(0)} <span class="unit">kt través</span>`
        : 'Calmo';
      el.resWindSub.textContent = st.windKt
        ? `Vento ${fmtHdg(st.windFrom)} / ${st.windKt} kt · través ${final.cross >= 0 ? 'pela direita' : 'pela esquerda'} · limite ${st.xwindLimit} kt`
        : 'Sem vento informado.';
    } else {
      el.resFinal.textContent = '—';
      el.resFinalSub.textContent = st.H == null ? 'Informe a orientação do “H”.' : 'Sem proa viável nos limites.';
      el.resWind.textContent = '—';
      el.resWindSub.textContent = 'Proa / través.';
    }

    el.resClass.textContent = `Classe ${cls.cls}`;
    el.resClassSub.textContent = cls.changed
      ? `Reclassificado (era Classe ${st.deckClass}) — vento de ${cls.sec}.`
      : (cls.sec ? `Vento de ${cls.sec} — sem reclassificação.` : 'Sem dados de vento/aproamento.');

    if (circuit){
      el.resCircuit.textContent = circuit.side === 'esq' ? 'Curvas à esquerda' : 'Curvas à direita';
      el.resCircuitSub.textContent = `PF no assento ${pf.side === 'esq' ? 'esquerdo' : 'direito'} — ` +
        (pf.why === 'slo' ? 'defasagem da final força o deck para este lado (SLO).'
         : pf.why === 'vento' ? `través pela ${final.cross > 0 ? 'direita' : 'esquerda'}: deck e vento pelo lado do PF.`
         : 'vento calmo/alinhado (perfil normal).') + ' Avaliar troca PF/PM após o sobrevoo.';
      el.legsBody.innerHTML = circuit.legs.map(l =>
        `<tr><td>${l.name}</td><td class="hdg">${fmtHdg(l.hdg)}</td><td>${l.gs} kt</td><td class="dim">${l.ref}</td></tr>`).join('');
      el.gaText.textContent = 'Antes do LDP: RETO EM FRENTE, no prolongamento da final deslocada — escape livre dentro do SLO. Após o LDP: pousar. Curvas de saída conforme briefing, para o lado livre de obstáculos.';
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

    if (!r || !r.st || r.st.H == null){
      ctx.fillStyle = 'rgba(157,176,196,.6)';
      ctx.font = '600 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Informe a orientação do “H” para desenhar o circuito.', cssW / 2, cssH / 2);
      return;
    }

    const st = r.st;
    const finalHdg = r.final ? r.final.hdg : norm(st.H);
    const side = r.circuit ? r.circuit.side : 'dir';
    const P = circuitPoints(finalHdg, side);

    // enquadramento (inclui posições dos rótulos para nada ficar cortado)
    const pts = [P.finalStart, P.abeam, P.ldp, P.escEnd, P.dwStart, P.dwTurn, P.c1, P.baseMid, P.c2, P.ovEnd, P.ovC, P.ovC2, P.D,
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
    const bis = st.sloBisector != null ? st.sloBisector : norm(st.H);
    const half = st.sloAngle / 2;
    const outBear = norm(bis + 180); // aeronave vem deste lado
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
    ctx.rotate(rad(norm(st.H)));
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

      // sobrevoo -> perna do vento (tracejado)
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = 'rgba(70,194,186,.5)';
      ctx.beginPath();
      ctx.moveTo(X(pAdd(P.D, P.f, -0.35)), Y(pAdd(P.D, P.f, -0.35)));
      ctx.lineTo(X(P.ovEnd), Y(P.ovEnd));
      ctx.quadraticCurveTo(X(P.ovC), Y(P.ovC), X(pAdd(P.ovC2, P.f, -0.2)), Y(pAdd(P.ovC2, P.f, -0.2)));
      ctx.lineTo(X(P.dwStart), Y(P.dwStart));
      ctx.stroke();
      ctx.setLineDash([]);
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
        SLO ${st.sloAngle}° · “H” ${fmtHdg(st.H)} · Vento ${st.windKt ? fmtHdg(st.windFrom) + ' / ' + st.windKt + ' kt' : 'calmo'}</div>
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
      else node.value = id === 'xwindLimit' ? '35' : '';
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
  evaluate();
})();
