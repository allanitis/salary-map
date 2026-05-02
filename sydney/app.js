// Greater Sydney suburb affordability map
// Static client-side: loads greater-sydney.geojson + prices.json once.

const APRA_BUFFER = 0.03;
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
const netMonthly = gross => (gross - annualTax(gross)) / 12;

function monthlyRepayment(loan, annualRate, years) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return loan / n;
  return loan * r / (1 - Math.pow(1 + r, -n));
}

// 0.10 -> green, 0.30 -> yellow, 0.50+ -> red
function ratioColour(ratio) {
  const t = Math.max(0, Math.min(1, (ratio - 0.10) / 0.40));
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

const cleanName = ssc => ssc.split(' (')[0].trim().toUpperCase();

// --- Map setup, locked to Greater Sydney ---
const SYD_BOUNDS = L.latLngBounds([-34.50, 149.85], [-32.95, 151.75]);

const map = L.map('map', {
  zoomControl: true,
  preferCanvas: true,
  maxBounds: SYD_BOUNDS,
  maxBoundsViscosity: 1.0,
  minZoom: 9,
  maxZoom: 16,
}).fitBounds(SYD_BOUNDS, { padding: [10, 10] });

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO',
  subdomains: 'abcd', maxZoom: 19,
}).addTo(map);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd', maxZoom: 19, pane: 'shadowPane',
}).addTo(map);

// --- State ---
let geo = null;
let prices = null;
let layer = null;
let currentType = 'house';
let selectedKey = null;

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
  const key = cleanName(feat.properties.SAL_NAME21);
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
  if (!r) return { color: '#c8cfdc', weight: 0.4, fillColor: '#dde2ea', fillOpacity: 0.55 };
  const isSel = cleanName(feat.properties.SAL_NAME21) === selectedKey;
  return {
    color: isSel ? '#0f172a' : '#ffffff',
    weight: isSel ? 2.4 : 0.6,
    fillColor: ratioColour(r.ratio),
    fillOpacity: 0.7,
  };
}

function renderSelected(feat) {
  const sel = $('selected');
  if (!feat) {
    sel.className = 'selected empty';
    sel.textContent = 'Click a suburb for details.';
    return;
  }
  const p = inputs();
  const r = computeForFeature(feat, p);
  const name = feat.properties.SAL_NAME21.replace(/\s*\(.*\)$/, '');
  if (!r) {
    sel.className = 'selected';
    sel.innerHTML = `<div class="name">${name}</div>
      <div style="color:var(--muted)">No median ${p.type} data (insufficient sales).</div>`;
    return;
  }
  const cls = classify(r.ratio);
  const tag = cls === 'aff' ? 'Affordable' : cls === 'stretch' ? 'Stretch' : 'Unaffordable';
  sel.className = 'selected';
  sel.innerHTML = `
    <div class="name">${name} <span class="tag" style="background:${ratioColour(r.ratio)}">${tag}</span></div>
    <table>
      <tr><td class="k">Median ${p.type}</td><td class="v">${fmt$(r.price)}</td></tr>
      <tr><td class="k">Loan @ ${(p.deposit*100)|0}% dep</td><td class="v">${fmt$(r.loan)}</td></tr>
      <tr><td class="k">Stressed repay/mo</td><td class="v">${fmt$(r.repay)}</td></tr>
      <tr><td class="k">Take-home/mo</td><td class="v">${fmt$(r.net)}</td></tr>
      <tr><td class="k">% of take-home</td><td class="v">${(r.ratio*100).toFixed(0)}%</td></tr>
      <tr><td class="k">Sample sales (18mo)</td><td class="v">${r.n}</td></tr>
    </table>`;
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
  $('handleSummary').textContent = `${aff} affordable · ${st} stretch · ${un} unaffordable`;
}

function rerender() {
  if (!layer) return;
  layer.setStyle(styleFn);
  // refresh selected detail with current inputs
  if (selectedKey) {
    const feat = geo.features.find(f => cleanName(f.properties.SAL_NAME21) === selectedKey);
    renderSelected(feat);
  }
  updateCounters();
}

function buildLegendGradient() {
  const stops = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    stops.push(ratioColour(0.10 + t * 0.40));
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

// Mobile sheet open/close
const sidebar = $('sidebar');
$('handle').addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

buildLegendGradient();

// --- Load data ---
Promise.all([
  fetch('greater-sydney.geojson').then(r => r.json()),
  fetch('prices.json').then(r => r.json()),
]).then(([g, pr]) => {
  geo = g;
  prices = pr;
  layer = L.geoJSON(g, {
    style: styleFn,
    onEachFeature: (feat, lyr) => {
      lyr.on('click', () => {
        selectedKey = cleanName(feat.properties.SAL_NAME21);
        rerender();
        renderSelected(feat);
        if (window.matchMedia('(max-width: 760px)').matches) {
          sidebar.classList.add('open');
        }
      });
      lyr.on('mouseover', () => {
        if (cleanName(feat.properties.SAL_NAME21) !== selectedKey) {
          lyr.setStyle({ weight: 1.6, color: '#0f172a' });
        }
      });
      lyr.on('mouseout', () => {
        if (cleanName(feat.properties.SAL_NAME21) !== selectedKey) {
          layer.resetStyle(lyr);
        }
      });
    },
  }).addTo(map);
  updateCounters();
}).catch(err => {
  console.error(err);
  alert('Failed to load map data: ' + err.message);
});
