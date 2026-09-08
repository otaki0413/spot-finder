import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (!enabled || !geocode) return;

    let active = true;
    let target: Center | null = null;
    let snapshot = initialState;
    let sequence = 0;
    let appliedSequence = 0;
    let lastStartedAt = -Infinity;
    let scheduled: ReturnType<typeof setTimeout> | null = null;
    let lastRequest: { id: number; center: Center } | null = null;
    const timeouts = new Map<number, ReturnType<typeof setTimeout>>();

    function publish(next: AddressState) {
      snapshot = next;
      setState((previous) =>
        previous.result === next.result && previous.updating === next.updating
          ? previous
          : next,
      );
    }

    function finish(
      id: number,
      requestedCenter: Center,
      result: AddressResult,
    ) {
      if (!active || !timeouts.has(id)) return;
      clearTimeout(timeouts.get(id));
      timeouts.delete(id);

      // 最新要求だけに限定すると、通信が遅い間は移動中の住所が更新されなくなる。
      if (id <= appliedSequence) return;
      appliedSequence = id;
      publish({
        result,
        updating:
          !target ||
          !sameCenter(requestedCenter, target) ||
          id !== sequence ||
          scheduled !== null,
      });
    }

    function start() {
      scheduled = null;
      if (!active || !target || !geocode) return;
      const requestedCenter = target;
      const id = ++sequence;
      lastStartedAt = Date.now();
      lastRequest = { id, center: requestedCenter };
      timeouts.set(
        id,
        setTimeout(
          () => finish(id, requestedCenter, { status: "error" }),
          ADDRESS_TIMEOUT_MS,
        ),
      );

      // Geocoderの通信は中断できない。期限切れ・破棄済みの応答はfinishで無視する。
      void (async () => {
        try {
          const address = await geocode(requestedCenter);
          finish(
            id,
            requestedCenter,
            address === null
              ? { status: "empty" }
              : { status: "success", address },
          );
        } catch {
          finish(id, requestedCenter, { status: "error" });
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
        if (
          lastRequest &&
          timeouts.has(lastRequest.id) &&
          sameCenter(lastRequest.center, target)
        ) {
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
      active = false;
      lookup.current = null;
      if (scheduled !== null) clearTimeout(scheduled);
      for (const timeout of timeouts.values()) clearTimeout(timeout);
      timeouts.clear();
    };
  }, [geocode, enabled]);

  useEffect(() => {
    lookup.current?.move(center);
  }, [center, geocode, enabled]);

  function retry() {
    lookup.current?.retry();
  }

  return { ...state, retry };
}
