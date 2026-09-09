import { useMapsLibrary } from "@vis.gl/react-google-maps";
import type { Center } from "./nearby-spots";
import { useCenterAddress } from "./use-center-address";

function getAddressMessage(
  result: ReturnType<typeof useCenterAddress>["result"],
  mapFailed: boolean,
) {
  if (mapFailed) return "地図を表示できないため、住所の取得を停止しています。";
  if (!result) return "住所を取得中";

  switch (result.status) {
    case "success":
      return result.address;
    case "empty":
      return "この地点の住所は見つかりませんでした";
    case "error":
      return "住所を取得できませんでした";
  }
}

export function CenterAddress({
  center,
  ready,
  moving,
  mapFailed,
}: {
  center: Center;
  ready: boolean;
  moving: boolean;
  mapFailed: boolean;
}) {
  const library = useMapsLibrary("geocoding");
  const geocoder = library ? new library.Geocoder() : null;
  const geocode = geocoder
    ? async (location: Center) => {
        const { results } = await geocoder.geocode({
          location,
          fulfillOnZeroResults: true,
        });
        return results[0]?.formatted_address ?? null;
      }
    : null;
  const address = useCenterAddress(center, geocode, ready && !mapFailed);
  const result = address.result;
  const message = getAddressMessage(result, mapFailed);

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
      <div className="flex min-h-5 items-center gap-3 text-xs">
        <h2 className="font-medium text-slate-500">地図中心の住所</h2>
        {!mapFailed && result && address.updating && (
          <span className="text-blue-700">更新中</span>
        )}
      </div>
      <div className="mt-1 flex min-h-11 items-center justify-between gap-3">
        <p
          role={mapFailed ? undefined : "status"}
          aria-busy={!mapFailed && (moving || address.updating)}
          className="min-w-0 break-words text-sm leading-5 text-slate-900"
        >
          {message}
        </p>
        {!mapFailed && result?.status === "error" && !address.updating && (
          <button
            type="button"
            aria-label="住所取得を再試行"
            onClick={address.retry}
            className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            再試行
          </button>
        )}
      </div>
    </div>
  );
}
