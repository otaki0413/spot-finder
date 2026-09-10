import type { PropsWithChildren } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CACHE_TIME_MS,
  INITIAL_CENTER,
  nearbySpotsOptions,
  type NearbySpot,
} from "./nearby-spots";
import { useSpotSearch } from "./use-spot-search";

const spot: NearbySpot = {
  id: 1,
  name: "東京のスポット",
  category: "観光名所",
  address: "東京都千代田区",
  latitude: INITIAL_CENTER.lat,
  longitude: INITIAL_CENTER.lng,
  distanceMeters: 10,
};
const otherCenter = { lat: 35.7, lng: 139.8 };
const clients: QueryClient[] = [];
const fetchMock = vi.fn<typeof fetch>();

function response(spots: NearbySpot[] = [spot]) {
  return new Response(JSON.stringify(spots), { status: 200 });
}

function pendingResponse() {
  return Promise.withResolvers<Response>();
}

function setup() {
  const client = new QueryClient();
  clients.push(client);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useSpotSearch(), { wrapper }) };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.unstubAllGlobals();
  vi.useRealTimers();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
});

describe("地図操作に伴うスポット検索", () => {
  it("表示中の結果は時間だけで消さず、未使用の結果を5分後に破棄する", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(response());
    const { result, client, unmount } = setup();
    act(() => result.current.idle(INITIAL_CENTER));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(result.current.spots).toEqual([spot]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CACHE_TIME_MS + 1);
    });
    expect(result.current.spots).toEqual([spot]);
    const key = nearbySpotsOptions(INITIAL_CENTER, 5).queryKey;
    expect(client.getQueryData(key)).toEqual([spot]);
    unmount();
    await vi.advanceTimersByTimeAsync(CACHE_TIME_MS - 1);
    expect(client.getQueryData(key)).toEqual([spot]);
    await vi.advanceTimersByTimeAsync(1);
    expect(client.getQueryData(key)).toBeUndefined();
  });

  it("初回idleで検索し、中心不変のidle・ズームでは期限経過後も再検索しない", async () => {
    fetchMock.mockResolvedValue(response());
    const { result, client } = setup();
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => result.current.centerChanged(INITIAL_CENTER));
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => result.current.idle(INITIAL_CENTER));
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "/api/spots/nearby?latitude=35.681236&longitude=139.767125&radiusKm=5",
    );
    expect(options?.cache).toBe("no-store");
    client.setQueryData(
      nearbySpotsOptions(INITIAL_CENTER, 5).queryKey,
      [spot],
      {
        updatedAt: Date.now() - CACHE_TIME_MS - 1,
      },
    );
    act(() => {
      result.current.centerChanged(INITIAL_CENTER);
      result.current.idle(INITIAL_CENTER);
      result.current.idle(INITIAL_CENTER);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.spots).toEqual([spot]);
  });

  it("移動開始で結果を隠し、idleまで通信せず、新しい中心の結果だけ表示する", async () => {
    const next = pendingResponse();
    fetchMock
      .mockResolvedValueOnce(response())
      .mockReturnValueOnce(next.promise);
    const { result } = setup();
    act(() => result.current.idle(INITIAL_CENTER));
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    act(() => result.current.centerChanged(otherCenter));
    expect(result.current.moving).toBe(true);
    expect(result.current.spots).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.idle(otherCenter));
    expect(result.current.spots).toBeUndefined();
    const nextSpot = { ...spot, id: 2, name: "移動先のスポット" };
    await act(async () => next.resolve(response([nextSpot])));
    await waitFor(() => expect(result.current.spots).toEqual([nextSpot]));
  });

  it.each([200, 503])(
    "移動前の遅い応答（%s）を無効にし、新しい結果を上書きしない",
    async (status) => {
      const old = pendingResponse();
      const next = pendingResponse();
      fetchMock
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(next.promise);
      const { result } = setup();
      act(() => result.current.idle(INITIAL_CENTER));
      const oldSignal = fetchMock.mock.calls[0][1]?.signal;
      act(() => result.current.centerChanged(otherCenter));
      expect(oldSignal?.aborted).toBe(true);
      act(() => result.current.idle(otherCenter));
      const nextSpot = { ...spot, id: 2 };
      await act(async () => next.resolve(response([nextSpot])));
      await waitFor(() => expect(result.current.spots).toEqual([nextSpot]));
      await act(async () =>
        old.resolve(new Response(JSON.stringify([spot]), { status })),
      );
      expect(result.current.spots).toEqual([nextSpot]);
      expect(result.current.searchFailed).toBe(false);
    },
  );

  it("中断後に同じ中心へすぐ戻っても検索を再開できる", async () => {
    const canceled = pendingResponse();
    fetchMock
      .mockReturnValueOnce(canceled.promise)
      .mockResolvedValueOnce(response());
    const { result } = setup();
    act(() => result.current.idle(INITIAL_CENTER));
    act(() => {
      result.current.centerChanged(otherCenter);
      result.current.centerChanged(INITIAL_CENTER);
      result.current.idle(INITIAL_CENTER);
    });
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("同じ半径の重複適用を抑え、元の半径の新鮮な結果を再利用する", async () => {
    const narrow = { ...spot, id: 2, distanceMeters: 50 };
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response([narrow]));
    const { result } = setup();
    act(() => result.current.idle(INITIAL_CENTER));
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    act(() => {
      result.current.applyRadius(1);
      result.current.applyRadius(1);
    });
    await waitFor(() => expect(result.current.spots).toEqual([narrow]));
    act(() => result.current.applyRadius(5));
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("半径を戻した時にキャッシュが期限切れなら再取得し、古い結果を表示しない", async () => {
    const refreshed = pendingResponse();
    fetchMock
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response([]))
      .mockReturnValueOnce(refreshed.promise);
    const { result, client } = setup();
    act(() => result.current.idle(INITIAL_CENTER));
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    act(() => result.current.applyRadius(1));
    await waitFor(() => expect(result.current.spots).toEqual([]));
    client.setQueryData(
      nearbySpotsOptions(INITIAL_CENTER, 5).queryKey,
      [spot],
      {
        updatedAt: Date.now() - CACHE_TIME_MS - 1,
      },
    );
    act(() => result.current.applyRadius(5));
    expect(result.current.spots).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await act(async () => refreshed.resolve(response([])));
    await waitFor(() => expect(result.current.spots).toEqual([]));
  });

  it("微小な座標変更を丸めず、移動中の半径変更はidleでまとめて検索する", async () => {
    fetchMock.mockImplementation(async () => response());
    const { result } = setup();
    act(() => result.current.idle(INITIAL_CENTER));
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    const slightlyMoved = {
      ...INITIAL_CENTER,
      lat: INITIAL_CENTER.lat + 0.0000001,
    };
    act(() => {
      result.current.centerChanged(slightlyMoved);
      result.current.applyRadius(2.5);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.radiusKm).toBe(2.5);
    act(() => result.current.idle(slightlyMoved));
    await waitFor(() => expect(result.current.spots).toEqual([spot]));
    const params = new URL(
      String(fetchMock.mock.calls[1][0]),
      "http://localhost",
    ).searchParams;
    expect(params.get("latitude")).toBe(String(slightlyMoved.lat));
    expect(params.get("radiusKm")).toBe("2.5");
  });

  it("失敗を0件と区別し、タブ復帰・再接続では再取得せず、手動で再試行する", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(response([]));
    const { result } = setup();
    act(() => result.current.idle(INITIAL_CENTER));
    await waitFor(() => expect(result.current.searchFailed).toBe(true));
    expect(result.current.spots).toBeUndefined();
    await act(async () => {
      focusManager.setFocused(false);
      onlineManager.setOnline(false);
      focusManager.setFocused(true);
      onlineManager.setOnline(true);
      result.current.idle(INITIAL_CENTER);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.spots).toEqual([]));
    expect(result.current.searchFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("地図ロード失敗で進行中の検索を中断し、以後検索しない", async () => {
    const pending = pendingResponse();
    fetchMock.mockReturnValueOnce(pending.promise);
    const { result } = setup();
    const failMap = result.current.failMap;
    act(() => result.current.idle(INITIAL_CENTER));
    // APIProviderのEffectを再実行せず、初回のコールバックでも最新の検索を中断する。
    expect(result.current.failMap).toBe(failMap);
    act(() => failMap());
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    await act(async () => pending.resolve(response()));
    act(() => {
      result.current.idle(otherCenter);
      result.current.applyRadius(2);
      result.current.retry();
    });
    expect(result.current.mapFailed).toBe(true);
    expect(result.current.failMap).toBe(failMap);
    expect(result.current.spots).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
