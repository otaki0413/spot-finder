import { useEffect, useEffectEvent, useReducer, useRef } from "react";
import { sameCenter, type Center } from "./nearby-spots";

export const ADDRESS_INTERVAL_MS = 1000;
export const ADDRESS_TIMEOUT_MS = 10_000;

export type GeocodeAddress = (center: Center) => Promise<string | null>;

type AddressResult =
  | { status: "success"; address: string }
  | { status: "empty" }
  | { status: "error" };

interface AddressRequest {
  center: Center;
  startedAt: number;
}

interface AddressState {
  // 0件・失敗でも同じ中心は自動で取り直さない。
  requested: Center | null;
  lastStartedAt: number;
  open: AddressRequest | null;
  result: AddressResult | null;
}

type AddressAction =
  | { type: "start"; request: AddressRequest }
  | { type: "finish"; request: AddressRequest; result: AddressResult }
  | { type: "retry" }
  | { type: "stop" };

const initialState: AddressState = {
  requested: null,
  lastStartedAt: -Infinity,
  open: null,
  result: null,
};

function reduce(state: AddressState, action: AddressAction): AddressState {
  switch (action.type) {
    case "start":
      return {
        ...state,
        requested: action.request.center,
        lastStartedAt: action.request.startedAt,
        open: action.request,
      };
    case "finish":
      // 同じ座標への再問い合わせも区別するため、オブジェクトの同一性で判定する。
      if (state.open !== action.request) return state;
      return { ...state, open: null, result: action.result };
    case "retry":
      if (state.open || state.result?.status !== "error") return state;
      return { ...state, requested: null, result: null };
    case "stop":
      return initialState;
  }
}

export function useCenterAddress(
  center: Center,
  geocode: GeocodeAddress | null,
  enabled: boolean,
) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const cancelRequest = useRef<(() => void) | null>(null);
  const available = enabled && geocode !== null;
  const needsRequest =
    available &&
    (state.requested === null || !sameCenter(state.requested, center));
  const updating = state.result === null || needsRequest || state.open !== null;

  useEffect(() => {
    if (!available) return;
    return () => {
      cancelRequest.current?.();
      cancelRequest.current = null;
      dispatch({ type: "stop" });
    };
  }, [available]);

  // 待機中に中心が変わってもタイマーを延ばさず、開始時の最新の中心を使う。
  const start = useEffectEvent(() => {
    if (!available) return;
    cancelRequest.current?.();
    const request = { center, startedAt: Date.now() };
    dispatch({ type: "start", request });

    // Geocoderの通信は中断できないため、不要になった応答は無視する。
    let ignore = false;
    const finish = (result: AddressResult) => {
      if (ignore) return;
      ignore = true;
      clearTimeout(timeout);
      dispatch({ type: "finish", request, result });
    };
    const timeout = setTimeout(
      () => finish({ status: "error" }),
      ADDRESS_TIMEOUT_MS,
    );
    cancelRequest.current = () => {
      ignore = true;
      clearTimeout(timeout);
    };

    // Reactの描画待ちを挟まず、時刻の記録と同じ処理内で通信を開始する。
    void (async () => {
      try {
        const address = (await geocode?.(request.center)) ?? null;
        finish(
          address === null
            ? { status: "empty" }
            : { status: "success", address },
        );
      } catch {
        finish({ status: "error" });
      }
    })();
  });
  useEffect(() => {
    if (!needsRequest) return;
    const delay = state.lastStartedAt + ADDRESS_INTERVAL_MS - Date.now();
    const timer = setTimeout(() => start(), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [needsRequest, state.lastStartedAt]);

  return {
    result:
      state.result?.status === "success" || !updating ? state.result : null,
    updating,
    retry: () => dispatch({ type: "retry" }),
  };
}
