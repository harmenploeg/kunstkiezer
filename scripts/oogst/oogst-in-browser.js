/* Stap 8: oogst tentoonstellingen uit een pagina die pas door JavaScript wordt opgebouwd.
 *
 * Draait IN de pagina (headless browser of het browserpaneel), nadat die geladen is.
 * Werkt op document.body.innerText, want begin- en einddatum staan vaak in losse
 * elementen; alleen innerText voegt ze zichtbaar samen.
 *
 * Geeft per datumbereik zowel het label ervoor als erna terug. Dat is nodig omdat de
 * volgorde per site verschilt: De Pont zet de titel vóór de datum, het TextielMuseum
 * erna. Welke van de twee de titel is, bepaalt de redactie of een regel per bron in
 * kk_source_ingress.
 *
 * Gebruik: wacht na het laden minstens drie seconden, sluit zo mogelijk de cookiemelding,
 * en roep dan oogstTentoonstellingen() aan.
 */
function oogstTentoonstellingen() {
  const MAAND = {
    januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7,
    augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
    january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10,
    jan: 1, feb: 2, mrt: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, okt: 10, oct: 10, nov: 11, dec: 12,
  };
  const mn = Object.keys(MAAND).sort((a, b) => b.length - a.length).join('|');

  const iso = (y, m, d) => {
    y = +y; if (y < 100) y += 2000;
    m = +m; d = +d;
    if (!m || !d || m > 12 || d > 31 || y < 2024 || y > 2031) return null;
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  };

  // bereik op één regel: "3 oktober 2026 t/m 21 maart 2027", ook zonder scheidingsteken
  const BEREIK = new RegExp(
    '(\\d{1,2})\\s+(' + mn + ')\\.?\\s*(\\d{4})?\\s*(?:t/m|tot en met|tot|until|through|–|—|-|\\s)\\s*' +
    '(\\d{1,2})\\s+(' + mn + ')\\.?\\s*(\\d{4})', 'gi');
  const BEREIK_NUM = new RegExp(
    '(\\d{1,2})[.\\-/](\\d{1,2})[.\\-/](\\d{2,4})\\s*(?:t/m|tot en met|–|—|-|/)\\s*' +
    '(\\d{1,2})[.\\-/](\\d{1,2})[.\\-/](\\d{2,4})', 'g');
  // losse datum op een eigen regel, voor kaarten die begin en eind apart tonen
  const LOS = new RegExp('^(\\d{1,2})\\s+(' + mn + ')\\.?\\s*(\\d{4})?$', 'i');
  const LOS_NUM = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/;

  const losseDatum = (s) => {
    let m = s.match(LOS);
    if (m) { const x = MAAND[m[2].toLowerCase()]; return x ? { d: +m[1], m: x, y: m[3] ? +m[3] : null } : null; }
    m = s.match(LOS_NUM);
    return m ? { d: +m[1], m: +m[2], y: +m[3] < 100 ? 2000 + +m[3] : +m[3] } : null;
  };

  const STRUCTUUR = /^(tentoonstelling|exhibition|verwacht|archief|nu te zien|expositie|agenda|bezoek|meer|lees meer|tickets)$/i;
  const regels = document.body.innerText.split('\n')
    .map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const vandaag = new Date().toISOString().slice(0, 10);

  const buur = (i, stap) => {
    for (let j = i + stap; j >= 0 && j < regels.length && Math.abs(j - i) < 4; j += stap) {
      const s = regels[j];
      if (!s || losseDatum(s) || s.length < 4 || s.length > 110 || STRUCTUUR.test(s)) continue;
      return s;
    }
    return '';
  };

  const uit = [];
  const bewaar = (i, index, lengte, start, eind) => {
    if (!start || !eind || start > eind || eind < vandaag) return;
    const voor = (regels[i].slice(0, index).trim() || buur(i, -1)).slice(-80);
    const na = (regels[i].slice(index + lengte).trim() || buur(i, 1)).slice(0, 80);
    if (voor.length > 3 || na.length > 3) uit.push({ voor, na, start, eind });
  };

  for (let i = 0; i < regels.length; i++) {
    for (const re of [BEREIK, BEREIK_NUM]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(regels[i]))) {
        let a, b;
        if (re === BEREIK) {
          const x = MAAND[m[2].toLowerCase()], y = MAAND[m[5].toLowerCase()];
          if (!x || !y) continue;
          a = iso(m[3] || m[6], x, m[1]); b = iso(m[6], y, m[4]);
        } else {
          a = iso(m[3], m[2], m[1]); b = iso(m[6], m[5], m[4]);
        }
        bewaar(i, m.index, m[0].length, a, b);
      }
    }
    // begin en eind op twee opeenvolgende regels
    const p = losseDatum(regels[i]);
    const q = i + 1 < regels.length ? losseDatum(regels[i + 1]) : null;
    if (p && q) {
      const a = iso(p.y || q.y, p.m, p.d), b = iso(q.y || p.y, q.m, q.d);
      if (a && b && a <= b && b >= vandaag) {
        const voor = buur(i, -1), na = buur(i + 1, 1);
        if (voor.length > 3 || na.length > 3) uit.push({ voor: voor.slice(-80), na: na.slice(0, 80), start: a, eind: b });
      }
    }
  }

  const gezien = new Set(), net = [];
  for (const r of uit) {
    const sleutel = (r.voor + r.na).toLowerCase() + r.start + r.eind;
    if (gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    net.push(r);
  }
  return { url: location.href, aantal: net.length, vondsten: net };
}
