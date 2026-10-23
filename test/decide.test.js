import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/decide.js';
const sha = 'abcdef1234567890';
const now = Date.parse('2026-10-23T12:00:00Z');
const run = (over) => ({ id: 1, run_number: 10, head_sha: sha, status: 'completed', conclusion: 'success', event: 'push', updated_at: '2026-10-23T10:00:00Z', html_url: 'u', ...over });

test('skips when the commit already has a successful run', () => {
  const d = decide([run()], { sha, now });
  assert.equal(d.skip, true); assert.match(d.reason, /already built 2h ago by run #10/);
});
test('builds when there is no earlier run or it failed', () => {
  assert.equal(decide([], { sha, now }).skip, false);
  assert.equal(decide([run({ conclusion: 'failure' })], { sha, now }).skip, false);
  assert.equal(decide([run({ head_sha: 'other' })], { sha, now }).skip, false);
});
test('rebuilds unchanged code once it is older than max-age-hours', () => {
  const d = decide([run({ updated_at: '2026-10-01T10:00:00Z' })], { sha, now, maxAgeHours: 168 });
  assert.equal(d.skip, false); assert.match(d.reason, /older than max-age-hours=168/);
  assert.equal(decide([run({ updated_at: '2026-10-01T10:00:00Z' })], { sha, now, maxAgeHours: 0 }).skip, true);
});
test('does not skip while another run of the commit is in progress', () => {
  const d = decide([run({ status: 'in_progress', conclusion: null })], { sha, now });
  assert.equal(d.skip, false); assert.match(d.reason, /in progress/);
});
