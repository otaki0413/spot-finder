import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDistance, parseRadius } from "./nearby-spots";
import { RadiusInput } from "./radius-input";

afterEach(cleanup);

describe("検索半径入力", () => {
  it("入力中は適用せず、Enterとblurで有効な小数を適用する", () => {
    const apply = vi.fn();
    render(<RadiusInput radiusKm={5} onApply={apply} />);
    const input = screen.getByRole("spinbutton", { name: "検索半径" });
    fireEvent.change(input, { target: { value: "2.5" } });
    expect(apply).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(apply).toHaveBeenLastCalledWith(2.5);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.blur(input);
    expect(apply).toHaveBeenLastCalledWith(1);
  });

  it.each(["", "0", "-1", "1e308"])(
    "不正値 %s は適用せず、現在の半径とエラーを表示する",
    (value) => {
      const apply = vi.fn();
      render(<RadiusInput radiusKm={5} onApply={apply} />);
      const input = screen.getByRole("spinbutton", { name: "検索半径" });
      fireEvent.change(input, { target: { value } });
      fireEvent.blur(input);
      expect(apply).not.toHaveBeenCalled();
      expect(input.getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByRole("alert").textContent).toContain(
        "現在の半径は5km",
      );
      fireEvent.change(input, { target: { value: "2" } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(apply).toHaveBeenLastCalledWith(2);
      expect(screen.queryByRole("alert")).toBeNull();
    },
  );

  it("有限なmに変換できる正数を受け付け、非数値・非有限値を拒否する", () => {
    expect(parseRadius("100000")).toBe(100000);
    expect(parseRadius("0.001")).toBe(0.001);
    for (const value of [" ", "abc", "NaN", "Infinity", "1e308", "0", "-1"]) {
      expect(parseRadius(value)).toBeNull();
    }
  });

  it("距離をm・kmで表示し、1kmへの丸め境界でも単位を整える", () => {
    expect(formatDistance(350.2)).toBe("350m");
    expect(formatDistance(999.6)).toBe("1km");
    expect(formatDistance(1234)).toBe("1.2km");
  });
});
