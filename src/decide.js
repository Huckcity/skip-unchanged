// Pure decision: given earlier runs of this commit, should the scheduled run be skipped?
export function decide(runs, { sha, maxAgeHours = 168, conclusions = ['success'], now = Date.now() }) {
  const short = String(sha).slice(0, 7);
  const done = runs.filter((r) => r.head_sha === sha && r.status === 'completed' && conclusions.includes(r.conclusion));
  if (!done.length) {
    const inProgress = runs.find((r) => r.head_sha === sha && r.status !== 'completed');
    if (inProgress) return { skip: false, reason: `commit ${short} has a run in progress (#${inProgress.run_number}); building to be safe`, run: inProgress };
    return { skip: false, reason: `commit ${short} has no earlier ${conclusions.join('/')} run` };
  }
  const latest = done.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))[0];
  const ageH = (now - new Date(latest.updated_at || latest.created_at).getTime()) / 3600e3;
  if (maxAgeHours > 0 && ageH > maxAgeHours) return { skip: false, reason: `commit ${short} was built ${Math.round(ageH)}h ago (run #${latest.run_number}), older than max-age-hours=${maxAgeHours}; rebuilding to catch dependency drift`, run: latest };
  return { skip: true, reason: `commit ${short} already built ${Math.round(ageH * 10) / 10}h ago by run #${latest.run_number} (${latest.event}); nothing changed since`, run: latest };
}
