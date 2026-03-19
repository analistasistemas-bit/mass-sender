const fs = require('fs');
const path = require('path');

async function main() {
  const baseUrl = (process.env.WA_BRIDGE_BASE_URL || 'http://127.0.0.1:3010').replace(/\/$/, '');
  const apiKey = process.env.WA_BRIDGE_API_KEY || '';
  const outPath = process.env.WA_BRIDGE_QR_PATH || '/tmp/mass-sender-wa-qr.png';

  const headers = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await fetch(`${baseUrl}/session/qr`, { headers });
  const payload = await response.json();

  if (!response.ok || !payload.base64) {
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }

  const buffer = Buffer.from(payload.base64.replace(/^data:image\/png;base64,/, ''), 'base64');
  fs.writeFileSync(outPath, buffer);
  console.log(path.resolve(outPath));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
