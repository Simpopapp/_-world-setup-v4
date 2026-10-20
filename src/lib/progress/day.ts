// Datas por chaves de dia local (PRD D5/D6): horário de verão não pode quebrar passos de 24 h.
export function getLocalDayKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Diferença em DIAS entre duas chaves locais (b - a), via data local — nunca via epoch. */
export function localDayDiff(a: string, b: string): number {
  const parse = (key: string): number => {
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    return new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  };
  const msPerDay = 86_400_000;
  const diff = parse(b) - parse(a);
  return Math.round(diff / msPerDay);
}

/** Sequência de estudo: dias consecutivos estudados até hoje (0 se hoje não estudou). */
export function streakFromDays(studiedDays: string[], today: string = getLocalDayKey()): number {
  const set = new Set(studiedDays);
  if (!set.has(today)) return 0;
  let streak = 1;
  const cursor = new Date(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  for (;;) {
    cursor.setDate(cursor.getDate() - 1);
    const key = getLocalDayKey(cursor.getTime());
    if (set.has(key)) streak += 1;
    else break;
  }
  return streak;
}
