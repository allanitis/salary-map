// Sydney suburb affordability map
// All maths runs client-side. Loads sydney.geojson + prices.json once.

const APRA_BUFFER = 0.03;       // stress test buffer
const LOAN_TERM_YEARS = 30;
const MEDICARE = 0.02;

// 2024-25 ATO resident tax brackets (post-Stage 3 cuts)
const BRACKETS = [
  { upTo: 18200,  rate: 0.00 },
  { upTo: 45000,  rate: 0.16 },
  { upTo: 135000, rate: 0.30 },
  { upTo: 190000, rate: 0.37 },
  { upTo: Infinity, rate: 0.45 },
];

function annualTax(gross) {
  let tax = 0, prev = 0;
  for (const b of BRACKETS) {
    if (gross <= b.upTo) { tax += (gross - prev) * b.rate; return tax + gross * MEDICARE; }
    tax += (b.upTo - prev) * b.rate;
    prev = b.upTo;
  }
  return tax + gross * MEDICARE;
}

function netMonthly(gross) {
  return (gross - annualTax(gross)) / 12;
}

function monthlyRepayment(loan, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return loan / n;
  return loan * r / (1 - Math.pow(1 + r, -n));
}

// ratio: stressed repayment / take-home monthly
function ratioColour(ratio) {
  // 0.10 -> green, 0.30 -> yellow, 0.50+ -> red
  const t = Math.max(0, Math.min(1, (ratio - 0.10) / 0.40));
  // green (46,204,113) -> yellow (241,196,15) -> red (231,76,60)
  let r, g, b;
  if (t < 0.5) {
    const k = t / 0.5;
    r = 46  + (241-46)  * k;
    g = 204 + (196-204) * k;
    b = 113 + (15-113)  * k;
  } else {
    const k = (t - 0.5) / 0.5;
    r = 241 + (231-241) * k;
    g = 196 + (76-196)  * k;
    b = 15  + (60-15)   * k;
  }
  return `rgb(${r|0},${g|0},${b|0})`;
}

function classify(ratio) {
  if (ratio == null) return 'none';
  if (ratio <= 0.30) return 'aff';
  if (ratio <= 0.40) return 'stretch';
  return 'unaff';
}

function fmt$(n) {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + Math.round(n / 1e3) + 'k';
  return '$' + Math.round(n).toLocaleString();
}

// Match GeoJSON SSC_NAME to prices.json key (clean, uppercase, no "(NSW)")
function cleanName(ssc) {
  return ssc.split(' (')[0].trim().toUpperCase();
}

// --- Map setup ---
const map = L.map('map', { zoomControl: true, preferCanvas: true })
  .setView([-33.86, 151.10], 11);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd', maxZoom: 19,
}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd', maxZoom: 19, pane: 'shadowPane',
}).addTo(map);

// --- State ---
let geo = null;
let prices = null;
let layer = null;
let currentType = 'house';

const $ = id => document.getElementById(id);

function inputs() {
  return {
    salary: +$('salary').value,
    rate: +$('rate').value / 100,
    deposit: +$('deposit').value / 100,
    type: currentType,
  };
}

function computeForFeature(feat, p) {
  const key = cleanName(feat.properties.SSC_NAME);
  const rec = prices[key];
  if (!rec || rec[p.type] == null) return null;
  const price = rec[p.type];
  const loan = price * (1 - p.deposit);
  const stressedRate = p.rate + APRA_BUFFER;
  const repay = monthlyRepayment(loan, stressedRate, LOAN_TERM_YEARS);
  const net = netMonthly(p.salary);
  const ratio = repay / net;
  return { price, loan, repay, net, ratio, n: rec[`n_${p.type}`] };
}

function styleFn(feat) {
  const p = inputs();
  const r = computeForFeature(feat, p);
  if (!r) return { color: '#3a4050', weight: 0.5, fillColor: '#2a2f3a', fillOpacity: 0.15 };
  return {
    color: '#0f1115',
    weight: 0.6,
    fillColor: ratioColour(r.ratio),
    fillOpacity: 0.78,
  };
}

function popupHTML(feat) {
  const p = inputs();
  const r = computeForFeature(feat, p);
  const name = feat.properties.SSC_NAME;
  if (!r) {
    return `<div class="info-popup"><div class="name">${name}</div>
      <div style="color:#888">No median ${p.type} data (insufficient sales).</div></div>`;
  }
  const cls = classify(r.ratio);
  const tag = cls === 'aff' ? 'Affordable' : cls === 'stretch' ? 'Stretch' : 'Unaffordable';
  const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:${ratioColour(r.ratio)};margin-right:6px"></span>`;
  return `<div class="info-popup">
    <div class="name">${name} — ${p.type}s</div>
    <div style="margin-bottom:6px">${dot}<b>${tag}</b> · ${(r.ratio*100).toFixed(0)}% of take-home</div>
    <table>
      <tr><td class="k">Median price</td><td>${fmt$(r.price)}</td></tr>
      <tr><td class="k">Loan @ ${(p.deposit*100)|0}% dep</td><td>${fmt$(r.loan)}</td></tr>
      <tr><td class="k">Stressed repay/mo</td><td>${fmt$(r.repay)}</td></tr>
      <tr><td class="k">Take-home/mo</td><td>${fmt$(r.net)}</td></tr>
      <tr><td class="k">Sample sales</td><td>${r.n}</td></tr>
    </table>
  </div>`;
}

function updateCounters() {
  let aff = 0, st = 0, un = 0;
  const p = inputs();
  for (const feat of geo.features) {
    const r = computeForFeature(feat, p);
    if (!r) continue;
    const c = classify(r.ratio);
    if (c === 'aff') aff++; else if (c === 'stretch') st++; else un++;
  }
  $('affCount').textContent = aff;
  $('stretchCount').textContent = st;
  $('unaffCount').textContent = un;
}

function rerender() {
  if (!layer) return;
  layer.setStyle(styleFn);
  updateCounters();
}

function buildLegendGradient() {
  const stops = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const ratio = 0.10 + t * 0.40;
    stops.push(ratioColour(ratio));
  }
  $('legendScale').style.background = `linear-gradient(to right, ${stops.join(',')})`;
}

// --- Wire up controls ---
function fmtSalary(v) { return '$' + (+v).toLocaleString(); }
function bindSlider(id, lblId, fmt) {
  const el = $(id), lbl = $(lblId);
  const update = () => { lbl.textContent = fmt(el.value); rerender(); };
  el.addEventListener('input', update);
  update();
}

bindSlider('salary',  'salaryLbl',  v => fmtSalary(v));
bindSlider('rate',    'rateLbl',    v => (+v).toFixed(2) + '%');
bindSlider('deposit', 'depositLbl', v => v + '%');

document.querySelectorAll('.toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentType = btn.dataset.type;
    rerender();
  });
});

buildLegendGradient();

// --- Load data ---
Promise.all([
  fetch('sydney.geojson').then(r => r.json()),
  fetch('prices.json').then(r => r.json()),
]).then(([g, pr]) => {
  geo = g;
  prices = pr;
  layer = L.geoJSON(g, {
    style: styleFn,
    onEachFeature: (feat, lyr) => {
      lyr.on('click', () => {
        lyr.bindPopup(popupHTML(feat)).openPopup();
      });
      lyr.on('mouseover', () => lyr.setStyle({ weight: 2, color: '#fff' }));
      lyr.on('mouseout',  () => layer.resetStyle(lyr));
    },
  }).addTo(map);
  map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  updateCounters();
}).catch(err => {
  console.error(err);
  alert('Failed to load map data: ' + err.message);
});
