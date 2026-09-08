"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AdvancedMarker,
  APIProvider,
  Circle,
  CollisionBehavior,
  Map,
} from "@vis.gl/react-google-maps";
import { INITIAL_CENTER, formatDistance } from "./nearby-spots";
import { CenterAddress } from "./center-address";
import { RadiusInput } from "./radius-input";
import { useSpotSearch } from "./use-spot-search";

const GOOGLE_MAPS_LIBRARIES = ["geocoding"];

function getSearchMessage(search: ReturnType<typeof useSpotSearch>) {
  if (search.mapFailed) {
    return "地図を表示できないため、検索を停止しています。";
  }
  if (!search.ready) {
    return "地図が表示されると、周辺のスポットを検索します。";
  }
  if (search.moving) {
    return "移動後に検索します";
  }
  if (search.searchFailed) {
    return "スポットを取得できませんでした。もう一度お試しください。";
  }
  if (!search.spots) {
    return "検索中…";
  }
  if (search.spots.length === 0) {
    return "この範囲にスポットはありません。地図を移動するか、検索半径を広げてください";
  }
  return `${search.spots.length}件のスポットが見つかりました。`;
}

function SpotSearch({ apiKey, mapId }: { apiKey: string; mapId: string }) {
  const search = useSpotSearch();

  return (
    <APIProvider
      apiKey={apiKey}
      language="ja"
      region="JP"
      libraries={GOOGLE_MAPS_LIBRARIES}
      onError={search.failMap}
    >
      <section aria-label="スポット検索">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <RadiusInput
            radiusKm={search.radiusKm}
            onApply={search.applyRadius}
          />
          <p className="text-sm text-slate-600">
            地図を移動すると、中心から{search.radiusKm}km以内を検索します。
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:h-[max(500px,calc(100svh-240px))]">
            <CenterAddress
              center={search.center}
              ready={search.ready}
              mapFailed={search.mapFailed}
            />
            <div
              aria-label="周辺スポットの地図"
              className="relative h-[52svh] min-h-80 lg:h-auto lg:min-h-0 lg:flex-1"
            >
              {search.mapFailed ? (
                <p
                  role="alert"
                  className="m-5 rounded-lg bg-white p-5 text-sm leading-6 text-red-800"
                >
                  地図を読み込めませんでした。ページを再読み込みしてください。
                </p>
              ) : (
                <>
                  <Map
                    defaultCenter={INITIAL_CENTER}
                    defaultZoom={12}
                    mapId={mapId}
                    onCenterChanged={(event) =>
                      search.centerChanged(event.detail.center)
                    }
                    onIdle={(event) => {
                      const center = event.map.getCenter();
                      if (center) search.idle(center.toJSON());
                    }}
                  >
                    <Circle
                      center={search.center}
                      radius={search.radiusKm * 1000}
                      clickable={false}
                      draggable={false}
                      editable={false}
                      strokeColor="#2563eb"
                      strokeWeight={2}
                      strokeOpacity={0.8}
                      fillColor="#3b82f6"
                      fillOpacity={0.08}
                    />
                    {search.spots?.map((spot) => (
                      <AdvancedMarker
                        key={spot.id}
                        position={{ lat: spot.latitude, lng: spot.longitude }}
                        title={spot.name}
                        collisionBehavior={CollisionBehavior.REQUIRED}
                      />
                    ))}
                  </Map>
                  {!search.ready && (
                    <p
                      role="status"
                      className="absolute left-4 top-4 rounded-lg bg-white px-4 py-3 text-sm shadow-sm"
                    >
                      地図を読み込んでいます…
                    </p>
                  )}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  >
                    <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                      <circle
                        cx="13"
                        cy="13"
                        r="5"
                        fill="white"
                        stroke="#1e40af"
                        strokeWidth="2"
                      />
                      <path
                        d="M13 1v6m0 12v6M1 13h6m12 0h6"
                        stroke="#1e40af"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                </>
              )}
            </div>
          </div>

          <section
            aria-labelledby="spots-heading"
            className="min-w-0 rounded-xl border border-slate-200 bg-white lg:max-h-[max(500px,calc(100svh-240px))] lg:overflow-y-auto"
          >
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 id="spots-heading" className="font-semibold text-slate-950">
                周辺のスポット
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                地図中心から近い順・距離は直線距離
              </p>
            </div>
            <div
              aria-live="polite"
              aria-atomic="true"
              className="px-5 py-4 text-sm leading-6 text-slate-600"
            >
              {getSearchMessage(search)}
              {search.searchFailed && (
                <button
                  type="button"
                  onClick={search.retry}
                  className="mt-3 block min-h-11 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                >
                  再試行
                </button>
              )}
            </div>
            {search.spots && search.spots.length > 0 && (
              <ul
                aria-label="検索結果"
                className="divide-y divide-slate-100 border-t border-slate-100"
              >
                {search.spots.map((spot) => (
                  <li key={spot.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 break-words font-semibold text-slate-900">
                        {spot.name}
                      </h3>
                      <span className="shrink-0 text-sm tabular-nums text-blue-700">
                        {formatDistance(spot.distanceMeters)}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                      {spot.address}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </section>
    </APIProvider>
  );
}

export function SpotFinder({
  apiKey,
  mapId,
}: {
  apiKey: string;
  mapId: string;
}) {
  const [client] = useState(() => new QueryClient());
  if (!apiKey) {
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950"
      >
        地図を表示するための設定が完了していません。設定後にページを再読み込みしてください。
      </p>
    );
  }

  return (
    <QueryClientProvider client={client}>
      <SpotSearch apiKey={apiKey} mapId={mapId} />
    </QueryClientProvider>
  );
}
