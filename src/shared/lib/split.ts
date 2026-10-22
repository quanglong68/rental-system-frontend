/**
 * Chia tiền theo ngày: mỗi ngày, chi phí ngày (tổng ÷ số ngày kỳ) chia đều cho
 * số người có mặt hôm đó, rồi cộng dồn thành phần của từng người.
 * stays: [ngày vào, ngày rời] theo số ngày trong kỳ (1..days), tính cả hai đầu.
 */
export function splitDaily(total: number, days: number, stays: [number, number][]) {
  const daily = total / days;
  const shares = stays.map(() => 0);
  const headcount: number[] = [];
  for (let d = 1; d <= days; d++) {
    const here = stays.flatMap(([a, b], i) => (d >= a && d <= b ? [i] : []));
    headcount.push(here.length);
    here.forEach((i) => (shares[i] += daily / here.length));
  }
  return { shares, headcount, daily };
}

/** Gom các ngày liên tiếp có cùng số người: [{ from, to, n }] để hiển thị công thức */
export function segments(headcount: number[]) {
  const out: { from: number; to: number; n: number }[] = [];
  headcount.forEach((n, i) => {
    const last = out[out.length - 1];
    if (last && last.n === n) last.to = i + 1;
    else out.push({ from: i + 1, to: i + 1, n });
  });
  return out;
}
