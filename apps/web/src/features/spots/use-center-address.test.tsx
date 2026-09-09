import { StrictMode, type PropsWithChildren } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_CENTER, type Center } from "./nearby-spots";
import {
  ADDRESS_INTERVAL_MS,
  ADDRESS_TIMEOUT_MS,
  useCenterAddress,
  type GeocodeAddress,
} from "./use-center-address";

const centerB = { lat: 35.7, lng: 139.8 };
const centerC = { lat: 35.8, lng: 139.9 };

function setup(ready = true) {
  const requests: ReturnType<typeof Promise.withResolvers<string | null>>[] =
    [];
  const startedAt: number[] = [];
  const geocode = vi.fn<GeocodeAddress>(() => {
    const request = Promise.withResolvers<string | null>();
    requests.push(request);
    startedAt.push(Date.now());
    return request.promise;
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StrictMode>{children}</StrictMode>
  );
  const initialProps: {
    center: Center;
    enabled: boolean;
    geocode?: GeocodeAddress | null;
  } = { center: INITIAL_CENTER, enabled: ready };
  const hook = renderHook(
    ({ center, enabled, geocode: currentGeocode = geocode }) =>
      useCenterAddress(center, currentGeocode, enabled),
    { initialProps, wrapper },
  );
  return {
    ...hook,
    geocode,
    startedAt,
    move: (center: Center) => hook.rerender({ center, enabled: true }),
    respond: (index: number, value: string | null | Error) =>
      act(async () => {
        if (value instanceof Error) requests[index].reject(value);
        else requests[index].resolve(value);
      }),
  };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("地図中心の住所取得", () => {
  it("取得関数の参照が変わっても、住所・取得間隔・応答順を維持する", async () => {
    const hook = setup();
    await advance(0);
    await advance(100);
    const replacement = vi.fn((center: Center) => hook.geocode(center));
    hook.rerender({
      center: INITIAL_CENTER,
      enabled: true,
      geocode: replacement,
    });
    await advance(0);
    expect(hook.geocode).toHaveBeenCalledTimes(1);

    hook.rerender({ center: centerB, enabled: true, geocode: replacement });
    await advance(899);
    expect(hook.geocode).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(replacement).toHaveBeenCalledExactlyOnceWith(centerB);
    await hook.respond(1, "Bの住所");
    await hook.respond(0, "古いAの住所");
    expect(hook.result.current).toMatchObject({
      result: { status: "success", address: "Bの住所" },
      updating: false,
    });

    hook.rerender({
      center: centerB,
      enabled: true,
      geocode: vi.fn((center: Center) => hook.geocode(center)),
    });
    await advance(1000);
    expect(hook.geocode).toHaveBeenCalledTimes(2);
    expect(hook.result.current.result).toEqual({
      status: "success",
      address: "Bの住所",
    });
  });

  it.each([
    { name: "無効化", enabled: false, unavailable: false },
    { name: "取得関数の未準備", enabled: true, unavailable: true },
  ])(
    "$nameから再開すると現在の中心を取得し、停止前の応答を無視する",
    async ({ enabled, unavailable }) => {
      const hook = setup();
      await advance(0);
      await hook.respond(0, "最初の住所");
      hook.move(centerB);
      await advance(1000);
      hook.rerender({
        center: centerB,
        enabled,
        geocode: unavailable ? null : hook.geocode,
      });
      expect(vi.getTimerCount()).toBe(0);
      hook.rerender({ center: centerC, enabled: true, geocode: hook.geocode });
      expect(hook.result.current.result).toBeNull();
      await advance(0);
      expect(hook.geocode).toHaveBeenLastCalledWith(centerC);
      await hook.respond(1, "停止前のBの住所");
      expect(hook.result.current.result).toBeNull();
      await hook.respond(2, "再開後のCの住所");
      expect(hook.result.current).toMatchObject({
        result: { status: "success", address: "再開後のCの住所" },
        updating: false,
      });
    },
  );

  it("地図の準備後に初回取得し、同じ中心の再描画や時間経過で再取得しない", async () => {
    const lookup = setup(false);
    await advance(1000);
    expect(lookup.geocode).not.toHaveBeenCalled();
    lookup.move(INITIAL_CENTER);
    await advance(0);
    expect(lookup.geocode).toHaveBeenCalledExactlyOnceWith(INITIAL_CENTER);
    await lookup.respond(0, "日本、東京都千代田区");
    lookup.move({ ...INITIAL_CENTER });
    await advance(60_000);
    expect(lookup.geocode).toHaveBeenCalledTimes(1);
    expect(lookup.result.current).toMatchObject({
      result: { status: "success", address: "日本、東京都千代田区" },
      updating: false,
    });
  });

  it("連続移動中も1秒ごとに最新中心を取得し、応答待ちでも次の取得を止めない", async () => {
    const lookup = setup();
    await advance(0);
    for (let i = 1; i <= 30; i++) {
      const center = { lat: INITIAL_CENTER.lat + i / 100_000, lng: 139.7 };
      lookup.move(center);
      await advance(100);
      if (i % 10 === 0) {
        expect(lookup.geocode).toHaveBeenLastCalledWith(center);
      }
    }
    expect(lookup.startedAt).toEqual([0, 1000, 2000, 3000]);
    await lookup.respond(1, "移動中の住所1");
    expect(lookup.result.current).toMatchObject({
      result: { address: "移動中の住所1" },
      updating: true,
    });
    await lookup.respond(2, "移動中の住所2");
    expect(lookup.result.current.result).toEqual({
      status: "success",
      address: "移動中の住所2",
    });
    await lookup.respond(3, "最終地点の住所");
    expect(lookup.result.current.updating).toBe(false);
    await advance(1000);
    expect(lookup.geocode).toHaveBeenCalledTimes(4);
  });

  it("微小移動も丸めず、停止時の最終中心を間隔を守って取得する", async () => {
    const lookup = setup();
    await advance(0);
    await lookup.respond(0, "最初の住所");
    await advance(200);
    lookup.move(centerB);
    const finalCenter = { ...centerB, lat: centerB.lat + 0.0000001 };
    await advance(200);
    lookup.move(finalCenter);
    expect(lookup.result.current).toMatchObject({
      result: { address: "最初の住所" },
      updating: true,
    });
    await advance(599);
    expect(lookup.geocode).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(lookup.geocode).toHaveBeenLastCalledWith(finalCenter);
    lookup.move({ ...finalCenter });
    await lookup.respond(1, "最終地点の住所");
    expect(lookup.result.current.updating).toBe(false);
    await advance(5000);
    expect(lookup.geocode).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["古い住所", "新しい住所"],
    [new Error("old error"), "新しい住所"],
    [null, "新しい住所"],
    ["古い住所", new Error("new error")],
    ["古い住所", null],
  ])(
    "新しい結果の後に届く古い成功・失敗・0件を無視する (%s → %s)",
    async (old, next) => {
      const lookup = setup();
      await advance(0);
      lookup.move(centerB);
      await advance(1000);
      await lookup.respond(1, next);
      const displayed = lookup.result.current.result;
      expect(lookup.result.current.updating).toBe(false);
      await lookup.respond(0, old);
      expect(lookup.result.current.result).toEqual(displayed);
      expect(lookup.result.current.updating).toBe(false);
    },
  );

  it("失敗時は住所を消し、手動再試行の連打も1秒間隔と重複防止に従う", async () => {
    const lookup = setup();
    await advance(0);
    await lookup.respond(0, "最初の住所");
    lookup.move(centerB);
    await advance(1000);
    await lookup.respond(1, new Error("failed"));
    expect(lookup.result.current).toMatchObject({
      result: { status: "error" },
      updating: false,
    });
    act(() => {
      lookup.result.current.retry();
      lookup.result.current.retry();
    });
    await advance(999);
    expect(lookup.geocode).toHaveBeenCalledTimes(2);
    await advance(1);
    act(() => lookup.result.current.retry());
    expect(lookup.geocode).toHaveBeenCalledTimes(3);
    await lookup.respond(2, "再試行した住所");
    expect(lookup.result.current.result).toEqual({
      status: "success",
      address: "再試行した住所",
    });
  });

  it.each([null, new Error("failed")])(
    "0件・失敗から同じ中心を自動再取得せず、中心変更で再開する (%s)",
    async (outcome) => {
      const lookup = setup();
      await advance(0);
      await lookup.respond(0, outcome);
      expect(lookup.result.current.result?.status).toBe(
        outcome === null ? "empty" : "error",
      );
      lookup.move({ ...INITIAL_CENTER });
      await advance(30_000);
      expect(lookup.geocode).toHaveBeenCalledTimes(1);
      if (outcome === null) {
        act(() => lookup.result.current.retry());
        await advance(0);
        expect(lookup.geocode).toHaveBeenCalledTimes(1);
      }
      lookup.move(centerB);
      await advance(0);
      expect(lookup.geocode).toHaveBeenLastCalledWith(centerB);
      expect(lookup.result.current.result).toBeNull();
      await lookup.respond(1, "移動先の住所");
      expect(lookup.result.current.updating).toBe(false);
    },
  );

  it("10秒で失敗扱いにし、期限切れの成功が再試行中に届いても復活させない", async () => {
    const lookup = setup();
    await advance(ADDRESS_TIMEOUT_MS - 1);
    expect(lookup.result.current.result).toBeNull();
    await advance(1);
    expect(lookup.result.current.result).toEqual({ status: "error" });
    act(() => lookup.result.current.retry());
    await advance(0);
    await lookup.respond(0, "期限切れの住所");
    expect(lookup.result.current.result).toBeNull();
    await lookup.respond(1, "新しい住所");
    expect(lookup.result.current.result).toEqual({
      status: "success",
      address: "新しい住所",
    });
  });

  it("古い問い合わせのタイムアウトが新しい住所を消さない", async () => {
    const lookup = setup();
    await advance(0);
    lookup.move(centerB);
    await advance(1000);
    await lookup.respond(1, "新しい住所");
    await advance(ADDRESS_TIMEOUT_MS);
    expect(lookup.result.current.result).toEqual({
      status: "success",
      address: "新しい住所",
    });
    expect(lookup.result.current.updating).toBe(false);
  });

  it("過去の地点へ戻った場合は表示済み住所をキャッシュから再利用しない", async () => {
    const lookup = setup();
    await advance(0);
    await lookup.respond(0, "Aの前回の住所");
    lookup.move(centerB);
    await advance(1000);
    await lookup.respond(1, "Bの住所");
    lookup.move(INITIAL_CENTER);
    await advance(1000);
    expect(lookup.geocode).toHaveBeenCalledTimes(3);
    expect(lookup.geocode).toHaveBeenLastCalledWith(INITIAL_CENTER);
    expect(lookup.result.current).toMatchObject({
      result: { address: "Bの住所" },
      updating: true,
    });
    await lookup.respond(2, "Aの今回の住所");
    expect(lookup.result.current.result).toEqual({
      status: "success",
      address: "Aの今回の住所",
    });
  });

  it("間隔待ち中に取得中の中心へ戻った場合は不要な予約を取り消す", async () => {
    const lookup = setup();
    await advance(0);
    lookup.move(centerB);
    await advance(200);
    lookup.move(INITIAL_CENTER);
    await lookup.respond(0, "最初の住所");
    expect(lookup.result.current.updating).toBe(false);
    await advance(1000);
    expect(lookup.geocode).toHaveBeenCalledTimes(1);
  });

  it("別地点への問い合わせ後に戻った場合も最後の中心への取得が残る", async () => {
    const lookup = setup();
    await advance(0);
    lookup.move(centerB);
    await advance(1000);
    lookup.move(INITIAL_CENTER);
    await lookup.respond(0, "最初のAの住所");
    expect(lookup.result.current.updating).toBe(true);
    await lookup.respond(1, "Bの住所");
    expect(lookup.result.current.updating).toBe(true);
    await advance(1000);
    expect(lookup.geocode).toHaveBeenLastCalledWith(INITIAL_CENTER);
    await lookup.respond(2, "最後のAの住所");
    expect(lookup.result.current.updating).toBe(false);
  });

  it.each(["unmount", "map-failed"])(
    "%sで予約とタイムアウトを破棄し、遅い応答も反映しない",
    async (operation) => {
      const lookup = setup();
      await advance(0);
      lookup.move(centerC);
      if (operation === "unmount") lookup.unmount();
      else lookup.rerender({ center: centerC, enabled: false });
      const previous = lookup.result.current.result;
      await lookup.respond(0, "破棄後の住所");
      await advance(ADDRESS_TIMEOUT_MS + ADDRESS_INTERVAL_MS);
      expect(lookup.geocode).toHaveBeenCalledTimes(1);
      expect(lookup.result.current.result).toBe(previous);
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
