import { queryOptions } from "@tanstack/react-query";

export interface Center {
  lat: number;
  lng: number;
}

export interface NearbySpot {
  id: number;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

export const INITIAL_CENTER: Center = { lat: 35.681236, lng: 139.767125 };
export const INITIAL_RADIUS_KM = 5;
export const CACHE_TIME_MS = 5 * 60 * 1000;

export function sameCenter(a: Center, b: Center): boolean {
  return a.lat === b.lat && a.lng === b.lng;
}

export function parseRadius(value: string): number | null {
  if (!value.trim()) return null;
  const radius = Number(value);
  return radius > 0 && Number.isFinite(radius * 1000) ? radius : null;
}

export function formatDistance(meters: number): string {
  const rounded = Math.round(meters);
  return rounded < 1000
    ? `${rounded}m`
    : `${(meters / 1000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}km`;
}

export function nearbySpotsOptions(center: Center, radiusKm: number) {
  return queryOptions({
    queryKey: ["spots", center.lat, center.lng, radiusKm] as const,
    queryFn: async ({ signal }): Promise<NearbySpot[]> => {
      const params = new URLSearchParams({
        latitude: String(center.lat),
        longitude: String(center.lng),
        radiusKm: String(radiusKm),
      });
      const response = await fetch(`/api/spots/nearby?${params}`, {
        signal,
        // 再利用期間はTanStack Queryで管理し、HTTPキャッシュと二重にしない。
        cache: "no-store",
      });
      if (!response.ok) throw new Error("スポットを取得できませんでした。");
      return response.json();
    },
    staleTime: CACHE_TIME_MS,
    gcTime: CACHE_TIME_MS,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // オフライン時も失敗として扱い、再接続による保留リクエストの自動再開を避ける。
    networkMode: "always",
  });
}
