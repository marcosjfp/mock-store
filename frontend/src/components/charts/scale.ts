/** Clean axis ticks (1/2/2.5/5 × 10ⁿ steps) covering 0…max. */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!(max > 0)) {
    return [0, 1];
  }
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ??
    10 * magnitude;
  const ticks: number[] = [];
  for (let tick = 0; tick < max + step - 1e-9; tick += step) {
    ticks.push(Number(tick.toFixed(10)));
  }
  return ticks;
}

/** Axis labels: in full under 10,000, compact (10K, 1.5M) once the axis reaches it. */
export function axisLabel(value: number, axisMax: number, prefix = ""): string {
  if (axisMax < 10_000) {
    return `${prefix}${value.toLocaleString("en-US")}`;
  }
  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
  return `${prefix}${compact.format(value)}`;
}
