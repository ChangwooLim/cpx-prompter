import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extractJson, parseScript, summarize } from '../skill/prompter/format.js';

const sample = JSON.parse(readFileSync(new URL('../sample.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(sample);
const untimed = () => {
  const s = clone();
  s.sections.forEach((sec) => delete sec.time);
  return s;
};
const errorsOf = (raw) => parseScript(raw).errors;
const assertError = (raw, ...parts) => {
  const { script, errors } = parseScript(raw);
  assert.equal(script, null);
  const hit = errors.find((e) => parts.every((p) => e.includes(p)));
  assert.ok(hit, `기대한 오류 ${parts} 없음:\n${errors.join('\n')}`);
};

test('sample.json parses and renders blocks in order', () => {
  const { script, errors } = parseScript(sample);
  assert.deepEqual(errors, []);
  assert.equal(script.limit, 600);
  assert.equal(script.total, 180);
  assert.equal(script.id, `u:${sample.title}`);
  assert.deepEqual(script.data[0], { t: 'h', n: 1, title: '도입', start: 0, end: 35 });
  assert.deepEqual(script.data[1].t, 'A');
  assert.ok(script.data.some((b) => b.t === 's'));
  assert.ok(script.data.some((b) => b.text?.includes('[[생략 가능]]')));
  assert.deepEqual(summarize(script), { sections: 4, lines: 21, total: 180, timed: true });
});

test('fenced ChatGPT paste with BOM and trailing notes is accepted', () => {
  const pasted = `﻿여기 있습니다.\n\`\`\`json\n${JSON.stringify(sample)}\n\`\`\`\n확인할 점 없음`;
  const { value, error } = extractJson(pasted);
  assert.equal(error, undefined);
  assert.deepEqual(errorsOf(value), []);
});

test('broken JSON reports line and column', () => {
  const { error } = extractJson('{\n  "a": 1\n  "b": 2\n}');
  assert.match(error, /JSON 형식이 올바르지 않습니다/);
  assert.match(error, /3번째 줄 3번째 칸/);
});

test('empty input is an error', () => {
  assert.ok(extractJson('  ').error);
});

test('wrong format value', () => {
  assertError({ ...clone(), format: 'cpx-prompter/2' }, 'format');
});

test('missing title', () => {
  assertError({ ...clone(), title: ' ' }, 'title');
});

test('unknown top-level key (typo)', () => {
  assertError({ ...clone(), line: [] }, '알 수 없는 키', '"line"');
});

test('unknown section key', () => {
  const s = clone();
  s.sections[1].line = [];
  assertError(s, '2번째 구간 "현병력"', '알 수 없는 키', '"line"');
});

test('empty sections', () => {
  assertError({ ...clone(), sections: [] }, 'sections');
});

test('section without title', () => {
  const s = clone();
  s.sections[0].title = '';
  assertError(s, '1번째 구간', 'title');
});

test('section with empty lines', () => {
  const s = clone();
  s.sections[2].lines = [];
  assertError(s, '3번째 구간 "자살 위험 평가"', 'lines');
});

test('line key must be one of the four kinds', () => {
  const s = clone();
  s.sections[1].lines[2] = { 의사님: '안녕하세요' };
  assertError(s, '2번째 구간 "현병력" 3번째 줄', '의사·환자·지시·소제목', '의사님');
});

test('line with two keys', () => {
  const s = clone();
  s.sections[0].lines[1] = { 의사: '안녕', 환자: '네' };
  assertError(s, '1번째 구간 "도입" 2번째 줄', '키가 하나만');
});

test('line with empty value', () => {
  const s = clone();
  s.sections[0].lines[1] = { 의사: '  ' };
  assertError(s, '1번째 구간 "도입" 2번째 줄', '"의사"', '문자열');
});

test('line that is not an object', () => {
  const s = clone();
  s.sections[0].lines[0] = '의사: 안녕';
  assertError(s, '1번째 구간 "도입" 1번째 줄', '객체');
});

test('time on some sections only', () => {
  const s = clone();
  delete s.sections[2].time;
  assertError(s, '모든 구간', '3번째 구간 "자살 위험 평가"');
});

test('first section must start at 0:00', () => {
  const s = clone();
  s.sections[0].time = '0:10-0:35';
  assertError(s, '1번째 구간 "도입"', '0:00');
});

test('gap between sections', () => {
  const s = clone();
  s.sections[1].time = '0:40-1:40';
  assertError(s, '2번째 구간 "현병력"', '0:40', '0:35', '이어지지');
});

test('end must be after start', () => {
  const s = clone();
  s.sections[0].time = '0:00-0:00';
  assertError(s, '1번째 구간 "도입"', '끝 시간');
});

test('time separators - – ~ with spaces are accepted', () => {
  const s = clone();
  s.sections[0].time = '0:00 – 0:35';
  s.sections[1].time = '0:35~1:40';
  s.sections[2].time = '1:40 - 2:25';
  assert.deepEqual(errorsOf(s), []);
});

test('malformed time string', () => {
  const s = clone();
  s.sections[0].time = '처음부터';
  assertError(s, '1번째 구간', 'm:ss-m:ss');
});

test('bad limit', () => {
  assertError({ ...clone(), limit: '열 분' }, 'limit');
});

test('auto timing is continuous from 0 and ends at total', () => {
  const { script, errors } = parseScript(untimed());
  assert.deepEqual(errors, []);
  const heads = script.data.filter((b) => b.t === 'h');
  assert.equal(heads[0].start, 0);
  heads.forEach((h, i) => {
    assert.ok(h.end > h.start);
    if (i) assert.equal(h.start, heads[i - 1].end);
    assert.equal(h.start % 5, 0);
  });
  assert.equal(heads.at(-1).end, script.total);
  assert.equal(script.total % 5, 0);
  assert.equal(script.timed, false);
});

test('given total is honored without times', () => {
  const { script, errors } = parseScript({ ...untimed(), total: '4:00' });
  assert.deepEqual(errors, []);
  assert.equal(script.total, 240);
  assert.equal(script.data.filter((b) => b.t === 'h').at(-1).end, 240);
});

test('total is rejected when sections have times', () => {
  assertError({ ...clone(), total: '4:00' }, 'total', 'time');
});

test('all errors are collected, not just the first', () => {
  const s = clone();
  s.title = '';
  s.sections[0].lines[0] = { 의사님: 'x' };
  s.sections[1].lines = [];
  assert.ok(errorsOf(s).length >= 3);
});

test('non-object top level', () => {
  assert.equal(parseScript([]).script, null);
  assert.equal(parseScript(null).script, null);
});
