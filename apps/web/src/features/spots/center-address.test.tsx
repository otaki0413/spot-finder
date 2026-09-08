import { StrictMode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CenterAddress } from "./center-address";
import { INITIAL_CENTER, type Center } from "./nearby-spots";

const { geocode, library } = vi.hoisted(() => {
  const geocode = vi.fn();
  return {
    geocode,
    library: {
      Geocoder: class {
        geocode = geocode;
      },
    },
  };
});

vi.mock("@vis.gl/react-google-maps", () => ({
  useMapsLibrary: () => library,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  geocode.mockReset();
  geocode.mockResolvedValue({ results: [{ formatted_address: "東京都" }] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("Compilerで取得関数を維持し、再描画で通信や1秒間隔の管理をリセットしない", async () => {
  function view(center: Center) {
    return (
      <StrictMode>
        <CenterAddress center={center} ready mapFailed={false} />
      </StrictMode>
    );
  }
  const screen = render(view(INITIAL_CENTER));
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(geocode).toHaveBeenCalledExactlyOnceWith({
    location: INITIAL_CENTER,
    fulfillOnZeroResults: true,
  });

  screen.rerender(view({ ...INITIAL_CENTER }));
  await act(() => vi.advanceTimersByTimeAsync(100));
  expect(geocode).toHaveBeenCalledTimes(1);

  const nextCenter = { lat: 35.7, lng: 139.8 };
  screen.rerender(view(nextCenter));
  await act(() => vi.advanceTimersByTimeAsync(899));
  expect(geocode).toHaveBeenCalledTimes(1);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(geocode).toHaveBeenCalledTimes(2);
  expect(geocode).toHaveBeenLastCalledWith({
    location: nextCenter,
    fulfillOnZeroResults: true,
  });

  screen.rerender(view({ ...nextCenter }));
  await act(() => vi.advanceTimersByTimeAsync(10_000));
  expect(geocode).toHaveBeenCalledTimes(2);
});
