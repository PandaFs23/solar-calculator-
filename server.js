const http = require('http');
const { URL } = require('url');
const { calculateSolarSizing } = require('./solar-calculator');

const PORT = process.env.PORT || 3001;

function sendJson(res, statusCode, payload) {
  const json = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json, 'utf8'),
  });
  res.end(json);
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk.toString(); });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return sendHtml(res, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Solar Calculator Local Host</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f7fb; color: #1b2437; margin: 0; padding: 40px; }
    h1 { margin-top: 0; }
    textarea, input, button { font-family: inherit; }
    .card { background: #ffffff; border-radius: 16px; padding: 24px; box-shadow: 0 20px 60px rgba(17, 34, 68, 0.08); max-width: 860px; margin: 0 auto; }
    .row { display: flex; gap: 16px; flex-wrap: wrap; }
    label { display: block; margin-bottom: 8px; font-weight: 700; }
    textarea { width: 100%; min-height: 220px; border: 1px solid #d3dce6; border-radius: 12px; padding: 14px; resize: vertical; }
    button { border: none; border-radius: 12px; padding: 12px 18px; background: #0066ff; color: white; cursor: pointer; }
    button:hover { background: #0052d4; }
    pre { background: #eef2f7; padding: 16px; border-radius: 12px; overflow: auto; }
    .small { font-size: 0.95rem; color: #57636d; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Solar Calculator Local Host</h1>
    <p class="small">Submit JSON to <code>/calculate</code> or use the form below to test it in your browser.</p>
    <div class="row" style="margin-bottom: 18px;">
      <div style="flex: 1 1 340px; min-width: 280px;">
        <label for="payload">Request JSON</label>
        <textarea id="payload">{
  "utilityId": "sdge",
  "inputMode": "kwh",
  "annualKwh": 8400,
  "panelProdId": "q_cells_q_home_next_l_g3_420_435_w",
  "invProdId": "enphase_iq8m",
  "battMode": "new",
  "battProdId": "pw3",
  "battUnits": 1
}</textarea>
      </div>
      <div style="flex: 1 1 220px; min-width: 220px; display:flex; flex-direction:column; gap:12px;">
        <button id="run">Run /calculate</button>
        <div><strong>Available utility IDs</strong><br>sdge, pge, custom</div>
        <div><strong>Sample body</strong></div>
        <pre>{
  "utilityId": "sdge",
  "inputMode": "kwh",
  "annualKwh": 8400,
  "panelProdId": "q_cells_q_home_next_l_g3_420_435_w",
  "invProdId": "enphase_iq8m",
  "battMode": "new",
  "battProdId": "pw3",
  "battUnits": 1
}</pre>
      </div>
    </div>
    <div>
      <label for="response">Response</label>
      <textarea id="response" readonly></textarea>
    </div>
  </div>
  <script>
    const button = document.getElementById('run');
    const payload = document.getElementById('payload');
    const response = document.getElementById('response');
    button.addEventListener('click', async () => {
      try {
        const body = JSON.parse(payload.value);
        const res = await fetch('/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        response.value = JSON.stringify(json, null, 2);
      } catch (err) {
        response.value = 'Error: ' + err.message;
      }
    });
  </script>
</body>
</html>`);
  }

  if (req.method === 'POST' && url.pathname === '/calculate') {
    try {
      const body = await parseBody(req);
      const result = calculateSolarSizing(body);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Solar calculator server running on http://localhost:${PORT}`);
});
