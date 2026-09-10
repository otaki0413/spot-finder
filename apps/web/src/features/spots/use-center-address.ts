import { useEffect, useEffectEvent, useReducer } from "react";
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
  | { type: "start"; center: Center; now: number }
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
        requested: action.center,
        lastStartedAt: action.now,
        open: { center: action.center, startedAt: action.now },
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
  const available = enabled && geocode !== null;
  const needsRequest =
    available &&
    (state.requested === null || !sameCenter(state.requested, center));
  const updating = needsRequest || state.open !== null;

  useEffect(() => {
    if (!available) return;
    return () => dispatch({ type: "stop" });
  }, [available]);

  // 待機中に中心が変わってもタイマーを延ばさず、開始時の最新の中心を使う。
  const start = useEffectEvent(() => {
    dispatch({ type: "start", center, now: Date.now() });
  });
  useEffect(() => {
    if (!needsRequest) return;
    const delay = state.lastStartedAt + ADDRESS_INTERVAL_MS - Date.now();
    const timer = setTimeout(() => start(), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [needsRequest, state.lastStartedAt]);

  // 取得関数が差し替わっても、進行中の問い合わせはそのまま続ける。
  const requestAddress = useEffectEvent(
    async (location: Center) => (await geocode?.(location)) ?? null,
  );
  useEffect(() => {
    const request = state.open;
    if (!available || !request) return;

    // Geocoderの通信は中断できないため、不要になった応答は無視する。
    let ignore = false;
    const finish = (result: AddressResult) => {
      if (ignore) return;
      ignore = true;
      dispatch({ type: "finish", request, result });
    };
    const deadline = request.startedAt + ADDRESS_TIMEOUT_MS - Date.now();
    const timeout = setTimeout(
      () => finish({ status: "error" }),
      Math.max(0, deadline),
    );
    requestAddress(request.center).then(
      (address) =>
        finish(
          address === null
            ? { status: "empty" }
            : { status: "success", address },
        ),
      () => finish({ status: "error" }),
    );
    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [available, state.open]);

  return {
    result:
      state.result?.status === "success" || !updating ? state.result : null,
    updating,
    retry: () => dispatch({ type: "retry" }),
  };
}
