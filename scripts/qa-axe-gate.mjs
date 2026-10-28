// Gate confirmed axe violations in the existing v0.3 browser acceptance.
// This is NOT a WCAG certification: incomplete/manual findings still require review.
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? 'output/playwright/release/axe.json';
const audits = JSON.parse(readFileSync(file, 'utf8'));
if (!Array.isArray(audits) || audits.length !== 10) {
  throw new Error(`Expected 10 JA/EN screen and dialog audits, found ${audits?.length ?? 'none'}`);
}
let confirmed = 0;
let incomplete = 0;
for (const audit of audits) {
  if (!Array.isArray(audit.violations) || !Array.isArray(audit.incomplete)) {
    throw new Error(`Missing axe findings for ${audit.name}`);
  }
  incomplete += audit.incomplete.length;
  for (const violation of audit.violations) {
    confirmed += violation.nodes.length;
    console.error(`axe ${audit.name}: ${violation.id} (${violation.impact}) ${violation.nodes.length} nodes`);
    for (const node of violation.nodes) {
      console.error(`  ${node.target.join(', ')}: ${node.failureSummary ?? ''}`);
    }
  }
}
console.log(`axe: ${audits.length} screens, ${confirmed} confirmed violating nodes, ${incomplete} incomplete rule results (manual review required)`);
if (confirmed) process.exitCode = 1;
