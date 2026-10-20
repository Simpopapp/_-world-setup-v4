import { describe, expect, it } from "vitest";
import { getLocalDayKey, localDayDiff, streakFromDays } from "./day";

describe("chaves de dia local", () => {
  it("formata YYYY-MM-DD local", () => {
    const ts = new Date(2026, 9, 20, 13, 45).getTime(); // 20/10/2026 local
    expect(getLocalDayKey(ts)).toBe("2026-10-20");
  });

  it("não desliza um dia com horário de verão (chave local, não epoch)", () => {
    // Mesmo instante avaliado por dois fusos não muda a chave de dia local calculada com a data local.
    const ts = new Date(2026, 1, 15, 12, 0).getTime();
    expect(getLocalDayKey(ts)).toBe("2026-02-15");
  });

  it("diferença em dias entre chaves locais", () => {
    expect(localDayDiff("2026-10-19", "2026-10-20")).toBe(1);
    expect(localDayDiff("2026-10-20", "2026-10-19")).toBe(-1);
  });

  it("streak conta dias consecutivos e zera sem estudo hoje", () => {
    expect(streakFromDays(["2026-10-19", "2026-10-20"], "2026-10-20")).toBe(2);
    expect(streakFromDays(["2026-10-18", "2026-10-19"], "2026-10-20")).toBe(0);
    expect(streakFromDays(["2026-10-20"], "2026-10-20")).toBe(1);
  });
});
