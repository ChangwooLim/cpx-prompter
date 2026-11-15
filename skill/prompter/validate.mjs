import { readFileSync } from 'node:fs';
import { extractJson, parseScript, summarize, formatClock } from './format.js';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('사용법: node validate.mjs <대본.json>...');
  process.exit(2);
}

let failed = false;
for (const file of files) {
  let problems;
  try {
    const parsed = extractJson(readFileSync(file, 'utf8'));
    if (parsed.error) problems = [parsed.error];
    else {
      const { script, errors } = parseScript(parsed.value);
      if (errors.length) problems = errors;
      else {
        const s = summarize(script);
        console.log(`OK  ${file}: ${script.label} · ${s.sections}구간 · ${s.lines}줄 · 길이 ${formatClock(s.total)} (${s.timed ? '구간 시간' : '자동 계산'})`);
      }
    }
  } catch (e) {
    problems = [`파일을 읽을 수 없습니다: ${e.message}`];
  }
  if (problems) {
    failed = true;
    console.log(`FAIL  ${file}`);
    for (const p of problems) console.log(`  - ${p}`);
  }
}
process.exit(failed ? 1 : 0);
