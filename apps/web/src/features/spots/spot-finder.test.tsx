import { useEffect } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type {
  APIProviderProps,
  AdvancedMarkerProps,
  CircleProps,
  MapCameraChangedEvent,
  MapEvent,
  MapProps,
} from "@vis.gl/react-google-maps";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_CENTER, type Center, type NearbySpot } from "./nearby-spots";
import { SpotFinder } from "./spot-finder";

let mapProps: MapProps;
let providerProps: APIProviderProps;
const mapMounted = vi.fn();
const fetchMock = vi.fn<typeof fetch>();

// Googleの描画だけを置き換え、アプリの入力・イベント・検索・一覧とマーカーの同期を通す。
vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: (props: APIProviderProps) => {
    providerProps = props;
    return props.children;
  },
  Map: (props: MapProps) => {
    mapProps = props;
    useEffect(() => {
      mapMounted();
    }, []);
    return <div data-testid="google-map">{props.children}</div>;
  },
  Circle: (props: CircleProps) => (
    <div data-testid="circle" data-radius={props.radius} />
  ),
  AdvancedMarker: (props: AdvancedMarkerProps) => (
    <div data-testid="marker" title={props.title} />
  ),
  CollisionBehavior: { REQUIRED: "REQUIRED" },
}));

function idle(center = INITIAL_CENTER) {
  mapProps.onIdle?.({
    map: { getCenter: () => ({ toJSON: () => center }) },
  } as unknown as MapEvent);
}

function move(center: Center) {
  mapProps.onCenterChanged?.({ detail: { center } } as MapCameraChangedEvent);
}

function response(spots: NearbySpot[]) {
  return new Response(JSON.stringify(spots), { status: 200 });
}

beforeEach(() => {
  mapMounted.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("地図と一覧の画面", () => {
  it("200件を同じ結果からマーカーと一覧に表示し、移動で両方隠し、半径変更でも地図を保つ", async () => {
    const spots = Array.from({ length: 200 }, (_, index) => ({
      id: index + 1,
      name: `スポット${index + 1}`,
      address: "東京都千代田区",
      latitude: INITIAL_CENTER.lat,
      longitude: INITIAL_CENTER.lng,
      distanceMeters: index * 10,
    }));
    fetchMock.mockImplementation(async () => response(spots));
    render(<SpotFinder apiKey="test-key" mapId="test-map" />);
    expect(screen.getByText("地図を読み込んでいます…")).toBeTruthy();
    act(() => idle());
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(200),
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(200);
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((item) => item.textContent),
    ).toEqual(spots.map((spot) => spot.name));
    const map = screen.getByTestId("google-map");
    const initialZoom = mapProps.defaultZoom;
    act(() => move({ lat: 35.7, lng: 139.8 }));
    expect(screen.queryAllByTestId("marker")).toHaveLength(0);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getByText("移動後に検索します")).toBeTruthy();
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByTestId("circle").getAttribute("data-radius")).toBe(
      "2500",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => idle({ lat: 35.7, lng: 139.8 }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(200),
    );
    expect(screen.getAllByTestId("marker")).toHaveLength(200);
    expect(screen.getByTestId("google-map")).toBe(map);
    expect(mapMounted).toHaveBeenCalledTimes(1);
    expect(mapProps.defaultZoom).toBe(initialZoom);
  });

  it("検索失敗に再試行を表示し、成功した0件では操作案内を表示する", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(response([]));
    render(<SpotFinder apiKey="test-key" mapId="test-map" />);
    act(() => idle());
    const retry = await screen.findByRole("button", { name: "再試行" });
    expect(screen.queryByText(/この範囲にスポットはありません/)).toBeNull();
    fireEvent.click(retry);
    await screen.findByText(/この範囲にスポットはありません/);
    expect(screen.queryByRole("button", { name: "再試行" })).toBeNull();
    expect((screen.getByRole("spinbutton") as HTMLInputElement).value).toBe(
      "5",
    );
    expect(mapMounted).toHaveBeenCalledTimes(1);
  });

  it("地図ロード失敗は再読み込みを案内し、専用の再試行ボタンは設けない", () => {
    render(<SpotFinder apiKey="test-key" mapId="test-map" />);
    const originalErrorHandler = providerProps.onError;
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "1" },
    });
    fireEvent.blur(screen.getByRole("spinbutton"));
    expect(providerProps.onError).toBe(originalErrorHandler);
    act(() => providerProps.onError?.(new Error("load failed")));
    expect(screen.getByRole("alert").textContent).toContain(
      "ページを再読み込みしてください",
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("google-map")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("キー未設定ではGoogle Mapsや検索を開始せず、設定案内を表示する", () => {
    render(<SpotFinder apiKey="" mapId="test-map" />);
    expect(screen.getByRole("alert").textContent).toContain(
      "設定が完了していません",
    );
    expect(screen.queryByTestId("google-map")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
