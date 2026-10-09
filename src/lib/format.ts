export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

export function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

export function humanize(constant: string): string {
  return constant.toLowerCase().replace(/_/g, " ");
}
