import { useEffect, useEffectEvent, useRef, useState } from "react";
import { sameCenter, type Center } from "./nearby-spots";

export const ADDRESS_INTERVAL_MS = 1000;
export const ADDRESS_TIMEOUT_MS = 10_000;

export type GeocodeAddress = (center: Center) => Promise<string | null>;

type AddressResult =
  | { status: "success"; address: string }
  | { status: "empty" }
  | { status: "error" };

interface AddressState {
  result: AddressResult | null;
  updating: boolean;
}

interface AddressLookup {
  move: (center: Center) => void;
  retry: () => void;
}

const initialState: AddressState = { result: null, updating: true };

export function useCenterAddress(
  center: Center,
  geocode: GeocodeAddress | null,
  enabled: boolean,
) {
  const [state, setState] = useState(initialState);
  const lookup = useRef<AddressLookup | null>(null);
  const available = enabled && geocode !== null;
  // 取得関数が変わっても、取得間隔と進行中の問い合わせは維持する。
  const requestAddress = useEffectEvent(
    async (location: Center) => (await geocode?.(location)) ?? null,
  );

  useEffect(() => {
    if (!available) return;

    let target: Center | null = null;
    let snapshot = initialState;
    let latestId = 0;
    let openId: number | null = null;
    let openCenter: Center | null = null;
    let lastStartedAt = -Infinity;
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    function publish(next: AddressState) {
      snapshot = next;
      setState((previous) =>
        previous.result === next.result && previous.updating === next.updating
          ? previous
          : next,
      );
    }

    function finish(id: number, result: AddressResult) {
      // 最新の未確定な問い合わせ以外は採用しない。
      if (id !== latestId || id !== openId) return;
      openId = null;
      openCenter = null;
      if (timeout !== null) clearTimeout(timeout);
      timeout = null;
      publish({ result, updating: scheduled !== null });
    }

    function start() {
      scheduled = null;
      if (!target) return;
      latestId = latestId + 1;
      const id = latestId;
      const requestedCenter = target;
      lastStartedAt = Date.now();
      openId = id;
      openCenter = requestedCenter;
      if (timeout !== null) clearTimeout(timeout);
      timeout = setTimeout(
        () => finish(id, { status: "error" }),
        ADDRESS_TIMEOUT_MS,
      );

      // Geocoderの通信は中断できない。期限切れ・破棄済みの応答はfinishで無視する。
      void (async () => {
        try {
          const address = await requestAddress(requestedCenter);
          if (address === null) {
            finish(id, { status: "empty" });
          } else {
            finish(id, { status: "success", address });
          }
        } catch {
          finish(id, { status: "error" });
        }
      })();
    }

    function schedule() {
      if (scheduled !== null) return;
      // 待機中の移動を最新の中心へまとめる。初回も予約し、Effect再実行時に破棄できる。
      scheduled = setTimeout(
        start,
        Math.max(0, lastStartedAt + ADDRESS_INTERVAL_MS - Date.now()),
      );
    }

    lookup.current = {
      move(nextCenter) {
        if (target && sameCenter(target, nextCenter)) return;
        target = nextCenter;
        publish({
          result:
            snapshot.result?.status === "success" ? snapshot.result : null,
          updating: true,
        });
        if (openId !== null && openCenter && sameCenter(openCenter, target)) {
          if (scheduled !== null) clearTimeout(scheduled);
          scheduled = null;
          return;
        }
        schedule();
      },
      retry() {
        if (snapshot.updating || snapshot.result?.status !== "error") return;
        publish(initialState);
        schedule();
      },
    };

    return () => {
      lookup.current = null;
      openId = null;
      openCenter = null;
      if (scheduled !== null) clearTimeout(scheduled);
      if (timeout !== null) clearTimeout(timeout);
    };
  }, [available]);

  // 取得処理を再作成したときも、その直後に現在の中心を渡す。
  useEffect(() => {
    lookup.current?.move(center);
  }, [center, available]);

  function retry() {
    lookup.current?.retry();
  }

  return { ...state, retry };
}
