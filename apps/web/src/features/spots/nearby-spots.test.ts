import { describe, expect, it } from "vitest";
import { parseRadius } from "./nearby-spots";

describe("検索半径の検証", () => {
  it("有限なmに変換できる正数を受け付け、不正値を拒否する", () => {
    for (const radius of [0.001, 2.5, 100000]) {
      expect(parseRadius(String(radius))).toBe(radius);
    }
    for (const value of [
      "",
      " ",
      "abc",
      "NaN",
      "Infinity",
      "1e308",
      "0",
      "-1",
    ]) {
      expect(parseRadius(value)).toBeNull();
    }
  });
});
