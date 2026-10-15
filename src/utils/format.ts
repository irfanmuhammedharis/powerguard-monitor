const pad = (n: number) => String(n).padStart(2, '0');

/** HH:MM in the phone's local time zone. */
export function clock(tsS: number): string {
  const d = new Date(tsS * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HH:MM:SS in the phone's local time zone. */
export function clockSeconds(tsS: number): string {
  const d = new Date(tsS * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
