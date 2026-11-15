export const FORMAT = 'cpx-prompter/1';

const LINE_KINDS = { 의사: 'D', 환자: 'P', 지시: 'A', 소제목: 's' };
const LINE_KEYS = Object.keys(LINE_KINDS);
const TOP_KEYS = ['format', 'title', 'limit', 'total', 'sections'];
const SECTION_KEYS = ['title', 'time', 'lines'];

const DEFAULT_LIMIT = 600;
const DOCTOR_CHARS_PER_MIN = 285;
const PATIENT_CHARS_PER_MIN = 200;
const PACE_MARGIN = 1.15;
const STEP = 5;

const CLOCK = /^(\d+):([0-5]\d)$/;
const RANGE = /^\s*(\d+:[0-5]\d)\s*[-–~]\s*(\d+:[0-5]\d)\s*$/;

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';
const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const parseClock = (s) => {
  const m = typeof s === 'string' ? CLOCK.exec(s.trim()) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const unknownKeys = (obj, allowed) => Object.keys(obj).filter((k) => !allowed.includes(k));

export function extractJson(text) {
  const body = String(text).replace(/^﻿/, '').trim();
  const fenced = /```(?:json)?[ \t]*\r?\n([\s\S]*?)```/i.exec(body);
  const source = (fenced ? fenced[1] : body).trim();
  if (source === '') return { error: '내용이 비어 있습니다.' };
  try {
    return { value: JSON.parse(source) };
  } catch (e) {
    return { error: `JSON 형식이 올바르지 않습니다${locate(source, e.message)}: ${e.message}` };
  }
}

function locate(source, message) {
  let line;
  let col;
  const lc = /line (\d+) column (\d+)/.exec(message);
  if (lc) [line, col] = [Number(lc[1]), Number(lc[2])];
  else {
    const pos = /position (\d+)/.exec(message);
    if (!pos) return '';
    const before = source.slice(0, Number(pos[1])).split('\n');
    [line, col] = [before.length, before[before.length - 1].length + 1];
  }
  return ` (${line}번째 줄 ${col}번째 칸 근처)`;
}

function speakingSeconds(lines) {
  const count = (kind) =>
    lines
      .filter((l) => l.t === kind)
      .map((l) =>
        l.text
          .replace(/\{[^}]*\}|\[\[[^\]]*\]\]|\[[^\]]*\]/g, '')
          .replace(/[\s\p{P}\p{S}]/gu, '').length,
      )
      .reduce((a, b) => a + b, 0);
  return (count('D') / DOCTOR_CHARS_PER_MIN + count('P') / PATIENT_CHARS_PER_MIN) * 60;
}

function autoBoundaries(weights, total) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const n = weights.length;
  const bounds = [0];
  let cum = 0;
  for (let i = 0; i < n; i++) {
    cum += sum > 0 ? weights[i] / sum : 1 / n;
    const raw = Math.round((total * cum) / STEP) * STEP;
    const lo = bounds[i] + STEP;
    const hi = total - STEP * (n - 1 - i);
    bounds.push(i === n - 1 ? total : Math.min(hi, Math.max(lo, raw)));
  }
  return bounds;
}

function readSection(sec, i, errors) {
  if (!isObject(sec)) {
    errors.push(`${i + 1}번째 구간: 구간은 객체여야 합니다`);
    return { where: `${i + 1}번째 구간`, blocks: [] };
  }
  const where = `${i + 1}번째 구간${isText(sec.title) ? ` "${sec.title}"` : ''}`;
  const fail = (msg) => errors.push(`${where}: ${msg}`);
  const blocks = [];

  for (const k of unknownKeys(sec, SECTION_KEYS)) {
    fail(`알 수 없는 키 "${k}"입니다 (쓸 수 있는 키: ${SECTION_KEYS.join(', ')})`);
  }
  if (!isText(sec.title)) fail('title은 비어 있지 않은 문자열이어야 합니다');
  if (!Array.isArray(sec.lines) || sec.lines.length === 0) {
    fail('lines는 비어 있지 않은 배열이어야 합니다');
    return { where, blocks };
  }
  sec.lines.forEach((line, j) => {
    const at = `${where} ${j + 1}번째 줄`;
    if (!isObject(line)) return errors.push(`${at}: 줄은 객체여야 합니다`);
    const keys = Object.keys(line);
    if (keys.length !== 1) {
      return errors.push(`${at}: 줄 하나에는 키가 하나만 있어야 합니다 (받은 키: ${keys.join(', ') || '없음'})`);
    }
    const [key] = keys;
    if (!LINE_KEYS.includes(key)) {
      return errors.push(`${at}: 키는 ${LINE_KEYS.join('·')} 중 하나여야 합니다 (받은 키: ${key})`);
    }
    if (!isText(line[key])) return errors.push(`${at}: "${key}"의 값은 비어 있지 않은 문자열이어야 합니다`);
    blocks.push({ t: LINE_KINDS[key], text: line[key] });
  });
  return { where, blocks };
}

function readTimes(sections, parsed, errors) {
  const given = sections.map((s) => isObject(s) && s.time !== undefined);
  const count = given.filter(Boolean).length;
  if (count === 0) return null;
  if (count !== sections.length) {
    const missing = parsed.map((p, i) => (given[i] ? null : p.where)).filter(Boolean);
    errors.push(`구간 시간(time)은 모든 구간에 쓰거나 하나도 쓰지 않아야 합니다 (없는 구간: ${missing.join(', ')})`);
    return null;
  }
  const times = [];
  let bad = false;
  sections.forEach((s, i) => {
    const m = typeof s.time === 'string' ? RANGE.exec(s.time) : null;
    if (!m) {
      bad = true;
      return errors.push(`${parsed[i].where}: time은 "m:ss-m:ss" 꼴이어야 합니다 (받은 값: ${JSON.stringify(s.time)})`);
    }
    const [start, end] = [parseClock(m[1]), parseClock(m[2])];
    if (end <= start) {
      bad = true;
      return errors.push(`${parsed[i].where}: 끝 시간 ${clock(end)}이 시작 시간 ${clock(start)}보다 늦어야 합니다`);
    }
    times.push([start, end]);
  });
  if (bad) return null;
  times.forEach(([start], i) => {
    const expected = i === 0 ? 0 : times[i - 1][1];
    if (start !== expected) {
      errors.push(
        i === 0
          ? `${parsed[i].where}: 첫 구간은 0:00에서 시작해야 합니다 (받은 값: ${clock(start)})`
          : `${parsed[i].where}: 시작 시간 ${clock(start)}이 앞 구간 끝 ${clock(expected)}과 이어지지 않습니다`,
      );
    }
  });
  return times;
}

export function parseScript(raw) {
  const errors = [];
  if (!isObject(raw)) return { script: null, errors: ['최상위는 { } 객체여야 합니다'] };

  if (raw.format !== FORMAT) errors.push(`format은 "${FORMAT}"이어야 합니다 (받은 값: ${JSON.stringify(raw.format)})`);
  if (!isText(raw.title)) errors.push('title은 비어 있지 않은 문자열이어야 합니다');
  for (const k of unknownKeys(raw, TOP_KEYS)) {
    errors.push(`알 수 없는 키 "${k}"입니다 (쓸 수 있는 키: ${TOP_KEYS.join(', ')})`);
  }

  let limit = DEFAULT_LIMIT;
  if (raw.limit !== undefined) {
    limit = parseClock(raw.limit);
    if (limit === null) {
      errors.push(`limit은 "m:ss" 꼴이어야 합니다 (받은 값: ${JSON.stringify(raw.limit)})`);
      limit = DEFAULT_LIMIT;
    }
  }

  if (!Array.isArray(raw.sections) || raw.sections.length === 0) {
    errors.push('sections는 비어 있지 않은 배열이어야 합니다');
    return { script: null, errors };
  }

  const parsed = raw.sections.map((sec, i) => readSection(sec, i, errors));
  const times = readTimes(raw.sections, parsed, errors);
  const timed = times !== null;

  let total = null;
  if (raw.total !== undefined) {
    total = parseClock(raw.total);
    if (total === null) errors.push(`total은 "m:ss" 꼴이어야 합니다 (받은 값: ${JSON.stringify(raw.total)})`);
    else if (raw.sections.every((s) => isObject(s) && s.time !== undefined)) {
      errors.push('구간 시간(time)이 있으면 total을 쓸 수 없습니다 (total은 마지막 구간 끝 시간입니다)');
    }
  }

  if (errors.length) return { script: null, errors };

  const weights = parsed.map((p) => speakingSeconds(p.blocks));
  if (timed) total = times[times.length - 1][1];
  else {
    total ??= Math.max(STEP * parsed.length, Math.round((weights.reduce((a, b) => a + b, 0) * PACE_MARGIN) / STEP) * STEP);
    if (total < STEP * parsed.length) {
      return { script: null, errors: [`total ${clock(total)}이 너무 짧습니다 (구간 ${parsed.length}개에 최소 ${clock(STEP * parsed.length)} 필요)`] };
    }
  }
  const bounds = timed ? null : autoBoundaries(weights, total);

  const data = [];
  parsed.forEach((p, i) => {
    const [start, end] = timed ? times[i] : [bounds[i], bounds[i + 1]];
    data.push({ t: 'h', n: i + 1, title: raw.sections[i].title, start, end }, ...p.blocks);
  });

  return { script: { id: `u:${raw.title}`, label: raw.title, limit, total, timed, data }, errors };
}

export function summarize(script) {
  const sections = script.data.filter((b) => b.t === 'h').length;
  return { sections, lines: script.data.length - sections, total: script.total, timed: script.timed };
}

export { clock as formatClock };
