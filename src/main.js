// Skip Unchanged: on a scheduled run, look for an earlier successful run of the same commit and say so.
import { appendFileSync } from 'node:fs';
import { decide } from './decide.js';

const input = (name, def = '') => { const v = process.env[`INPUT_${name.toUpperCase().replace(/-/g, '_')}`]; return v === undefined || v === '' ? def : v; };
const out = (k, v) => { const f = process.env.GITHUB_OUTPUT; if (f) appendFileSync(f, `${k}=${String(v).replace(/\n/g, ' ')}\n`); };

async function gh(url, token, method = 'GET') {
  const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}${url}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'skip-unchanged' } });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 202 || res.status === 204 ? null : res.json();
}

async function main() {
  const token = input('token', process.env.GITHUB_TOKEN);
  const repo = process.env.GITHUB_REPOSITORY, sha = process.env.GITHUB_SHA, event = process.env.GITHUB_EVENT_NAME, runId = Number(process.env.GITHUB_RUN_ID);
  const workflowRef = process.env.GITHUB_WORKFLOW_REF || ''; // owner/repo/.github/workflows/ci.yml@refs/heads/main
  const thisFile = workflowRef.split('/.github/workflows/')[1]?.split('@')[0] || '';
  const events = input('events', 'schedule').split(',').map((s) => s.trim()).filter(Boolean);
  const maxAgeHours = Number(input('max-age-hours', '168'));
  const files = (input('workflows', '') || thisFile).split(',').map((s) => s.trim()).filter(Boolean);
  const conclusions = input('conclusions', 'success').split(',').map((s) => s.trim()).filter(Boolean);
  const cancel = input('cancel', 'false') === 'true';

  if (!events.includes(event)) { out('skip', 'false'); out('reason', `event ${event} is not in [${events.join(', ')}]`); console.log(`Not a ${events.join('/')} run (${event}); never skipping.`); return; }
  const runs = [];
  for (const f of files) {
    const r = await gh(`/repos/${repo}/actions/workflows/${encodeURIComponent(f)}/runs?head_sha=${sha}&per_page=50`, token).catch((e) => { console.log(`::warning::could not list runs of ${f}: ${e.message}`); return { workflow_runs: [] }; });
    runs.push(...(r.workflow_runs || []).filter((x) => x.id !== runId));
  }
  const d = decide(runs, { sha, maxAgeHours, conclusions, now: Date.now() });
  out('skip', d.skip ? 'true' : 'false'); out('reason', d.reason); if (d.run) out('previous-run-url', d.run.html_url);
  console.log(d.skip ? `Skipping: ${d.reason}` : `Building: ${d.reason}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Skip Unchanged\n\n${d.skip ? '⏭️ Skipped' : '▶️ Running'}: ${d.reason}${d.run ? ` ([previous run](${d.run.html_url}))` : ''}\n`);
  if (d.skip && cancel) { console.log('Cancelling this run.'); await gh(`/repos/${repo}/actions/runs/${runId}/cancel`, token, 'POST'); }
}
main().catch((e) => { console.log(`::warning::skip-unchanged failed open: ${e.message}`); out('skip', 'false'); out('reason', `error: ${e.message}`); });
