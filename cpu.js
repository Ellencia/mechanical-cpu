// 기계의 논리: 화면과 무관. 브라우저에선 <script src>로 전역에, Node에선 `node cpu.js`로 self-check.
const OPS = ['ADD', 'CLR', 'JNC'];
const ROWS = 8;

function next(ones, tens) {
  ones += 1;
  if (ones === 10) {
    ones = 0; tens += 1;
    const overflow = tens === 10;
    if (overflow) tens = 0;
    return {ones, tens, carry: true, overflow};
  }
  return {ones, tens, carry: false, overflow: false};
}
// ADD k 는 "+= 1 을 k번". 크랭크 1회의 하위 스텝 목록.
function addSteps(ones, tens, k) {
  const steps = [];
  for (let i = 0; i < k; i++) { const n = next(ones, tens); steps.push(n); ({ones, tens} = n); }
  return steps;
}
// 드럼 한 행 실행 → 새 레지스터 값, 새 C, 점프 여부.
function execRow(ones, tens, c, row) {
  // CLR은 두 기어를 앞으로 돌려 0에 맞춘다(carry 없이)
  if (row.op === 'CLR') return {dOnes: (10 - ones) % 10, dTens: (10 - tens) % 10, ones: 0, tens: 0, c: 0, jump: false};
  if (row.op === 'JNC') return {ones, tens, c, jump: !c};
  const steps = addSteps(ones, tens, row.k), last = steps[steps.length - 1] || {ones, tens};
  return {steps, ones: last.ones, tens: last.tens, c: steps.some(x => x.carry) ? 1 : 0, jump: false};
}
const opText = row => row.op === 'JNC' ? `JNC → ${row.k}` : row.op === 'CLR' ? 'CLR' : `ADD ${row.k}`;

// 드럼 = 프로그램. 행 하나 = {op, k}.
// 기본: 0으로 지우고, carry가 날 때까지 3씩 더하고, 그다음 carry가 날 때까지 7씩 더한다.
const drum = [
  {op: 'CLR', k: 0},
  {op: 'ADD', k: 3},
  {op: 'JNC', k: 1},     // carry 없으면 1행으로 = while not C
  {op: 'ADD', k: 7},
  {op: 'JNC', k: 3},
  {op: 'ADD', k: 0},     // ADD 0 = 아무것도 안 함 (NOP)
  {op: 'ADD', k: 0},
  {op: 'ADD', k: 0},
];

// 실패 수를 돌려준다. 브라우저에선 콘솔 에러, Node에선 종료 코드.
function selfCheck() {
  let fails = 0;
  const check = (ok, ...msg) => { if (!ok) { fails++; console.error('FAIL', ...msg); } };
  let o = 0, t = 0;
  for (let i = 1; i <= 250; i++) {
    ({ones: o, tens: t} = next(o, t));
    check(o + 10 * t === i % 100, 'counter wrong at', i);
  }
  for (let a = 0; a < 100; a++) for (let b = 0; b < 10; b++) {
    const s = addSteps(a % 10, Math.floor(a / 10), b);
    const last = s[b - 1] || {ones: a % 10, tens: Math.floor(a / 10)};
    check(last.ones + 10 * last.tens === (a + b) % 100, 'add wrong', a, b);
    check(s.filter(x => x.carry).length <= 1, 'k≤9면 carry는 크랭크당 최대 1번', a, b);
  }
  // 기계 실행 vs 그냥 산수 (carry = 1의 자리가 10을 넘었는가)
  let c = 0, pc = 0, a = 8, ac = 0, apc = 0;
  o = 8; t = 0;
  for (let i = 0; i < 80; i++) {
    const r = execRow(o, t, c, drum[pc]);
    ({ones: o, tens: t, c} = r);
    pc = r.jump ? drum[pc].k : (pc + 1) % ROWS;
    const row = drum[apc];
    if (row.op === 'CLR') { a = 0; ac = 0; apc = (apc + 1) % ROWS; }
    else if (row.op === 'ADD') { ac = (a % 10) + row.k >= 10 ? 1 : 0; a = (a + row.k) % 100; apc = (apc + 1) % ROWS; }
    else apc = ac ? (apc + 1) % ROWS : row.k;
    check(o + 10 * t === a && c === ac && pc === apc, 'program wrong at', i);
  }
  return fails;
}

if (typeof module !== 'undefined') {
  module.exports = {OPS, ROWS, next, addSteps, execRow, opText, drum, selfCheck};
  if (require.main === module) {
    const fails = selfCheck();
    console.log(fails ? `self-check: ${fails} FAIL` : 'self-check: OK');
    process.exit(fails ? 1 : 0);
  }
} else selfCheck();
