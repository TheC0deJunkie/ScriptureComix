#!/usr/bin/env node
/* Register, list, delete or check the Yoco webhook this app listens on.
   ─────────────────────────────────────────────────────────────────────────
   Yoco has no dashboard field for webhooks: the URL is POSTed to
   /api/webhooks and the signing secret comes back ONCE in that response.
   A deployment with a secret key and no webhook secret takes money and
   grants nothing, which is what `check` exists to catch.

   The key is read from the environment, never from the command line:

     YOCO_SECRET_KEY=sk_test_… node scripts/registerYocoWebhook.mjs list
     YOCO_SECRET_KEY=sk_test_… node scripts/registerYocoWebhook.mjs register https://scripture-comix.vercel.app/api/yoco-webhook
     YOCO_SECRET_KEY=sk_test_… node scripts/registerYocoWebhook.mjs register <url> --vercel production
     YOCO_SECRET_KEY=sk_test_… node scripts/registerYocoWebhook.mjs delete <id>
     YOCO_SECRET_KEY=… YOCO_WEBHOOK_SECRET=whsec_… node scripts/registerYocoWebhook.mjs check

   `--vercel <environment>` stores the returned secret straight into the
   Vercel project's env (YOCO_WEBHOOK_SECRET) without printing it.

   Test and live are separate registrations with separate secrets, selected
   by which key you run this with. The webhook handler refuses an event whose
   mode does not match its key. */
import { spawnSync } from 'node:child_process';

const API = 'https://payments.yoco.com/api';
const VERCEL_SCOPE = process.env.VERCEL_SCOPE || 'konvrg-dev-team';

const secret = (process.env.YOCO_SECRET_KEY || '').trim();
if (!secret) {
  console.error('YOCO_SECRET_KEY is not set. Pass it in the environment, not as an argument.');
  process.exit(2);
}
const mode = secret.startsWith('sk_test') ? 'test' : 'live';

async function call(path, init) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await r.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!r.ok) throw new Error(`Yoco ${path} → ${r.status}: ${body.message || body.description || text}`);
  return body;
}

const rowsOf = (body) => (Array.isArray(body) ? body : (body.subscriptions ?? body.data ?? []));

function storeInVercel(name, value, environment) {
  // Remove first so a re-run replaces rather than fails; ignore "not found".
  spawnSync('npx', ['--no-install', 'vercel', 'env', 'rm', name, environment, '--yes', '--scope', VERCEL_SCOPE], { stdio: 'ignore', shell: true });
  const r = spawnSync('npx', ['--no-install', 'vercel', 'env', 'add', name, environment, '--scope', VERCEL_SCOPE], { input: value, encoding: 'utf8', shell: true });
  if (r.status !== 0) throw new Error(`vercel env add ${name} failed:\n${r.stderr || r.stdout}`);
  console.log(`Stored ${name} in Vercel (${environment}). Redeploy for it to take effect.`);
}

const [command, arg, flag, flagArg] = process.argv.slice(2);

try {
  if (command === 'list') {
    const rows = rowsOf(await call('/webhooks'));
    console.log(`${rows.length} webhook(s) on this ${mode}-mode account:`);
    for (const w of rows) console.log(`  ${w.id}  ${w.mode ?? mode}  ${w.name ?? '(unnamed)'}  ${w.url}`);
  } else if (command === 'register') {
    if (!arg || !/^https:\/\//.test(arg)) {
      console.error('Pass the full https URL of the webhook route, e.g. https://scripture-comix.vercel.app/api/yoco-webhook');
      process.exit(2);
    }
    if (!arg.endsWith('/api/yoco-webhook')) console.warn(`⚠ ${arg} does not end in /api/yoco-webhook — check the path.\n`);
    const w = await call('/webhooks', { method: 'POST', body: JSON.stringify({ name: `scripturecomix-${mode}`, url: arg }) });
    console.log(`Registered ${w.id} (${w.mode ?? mode}) → ${w.url}`);
    if (!w.secret) {
      console.error('Yoco returned no secret. Delete this webhook and register again.');
      process.exitCode = 1;
    } else if (flag === '--vercel') {
      storeInVercel('YOCO_WEBHOOK_SECRET', w.secret, flagArg || 'production');
    } else {
      console.log('\nTHE SIGNING SECRET IS SHOWN ONCE. Put it in the deployment env as YOCO_WEBHOOK_SECRET:\n');
      console.log(`  YOCO_WEBHOOK_SECRET=${w.secret}\n`);
    }
  } else if (command === 'delete') {
    if (!arg) { console.error('Pass the webhook id (see `list`).'); process.exit(2); }
    await call(`/webhooks/${encodeURIComponent(arg)}`, { method: 'DELETE' });
    console.log(`Deleted ${arg}. Its secret is dead; remove it from YOCO_WEBHOOK_SECRET.`);
  } else if (command === 'check') {
    const hook = (process.env.YOCO_WEBHOOK_SECRET || '').trim();
    const problems = [];
    if (!hook) problems.push('YOCO_WEBHOOK_SECRET is not set: every event will be refused.');
    else if (!hook.startsWith('whsec_')) problems.push('YOCO_WEBHOOK_SECRET does not start with whsec_ (is that the API key?).');
    else if (!Buffer.from(hook.slice(6), 'base64').length) problems.push('YOCO_WEBHOOK_SECRET does not base64-decode.');
    const rows = rowsOf(await call('/webhooks'));
    if (!rows.length) problems.push(`No webhook is registered on this ${mode}-mode account.`);
    console.log(`key mode: ${mode}\nregistered webhooks: ${rows.length}`);
    for (const w of rows) console.log(`  ${w.id}  ${w.mode ?? mode}  ${w.url}`);
    console.log(`YOCO_WEBHOOK_SECRET: ${hook ? 'set' : 'MISSING'}`);
    if (problems.length) {
      console.error('\nProblems:');
      for (const p of problems) console.error(`  ✗ ${p}`);
      process.exitCode = 1;
    } else {
      console.log('\n✓ Key, signing secret and a registration are all present. Only a real test payment proves they match.');
    }
  } else {
    console.error('Commands: list | register <https url> [--vercel <environment>] | delete <id> | check');
    process.exit(2);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
