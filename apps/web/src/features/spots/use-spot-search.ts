import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  INITIAL_CENTER,
  INITIAL_RADIUS_KM,
  nearbySpotsOptions,
  sameCenter,
  type Center,
} from "./nearby-spots";

const initialState = {
  center: INITIAL_CENTER,
  searchCenter: INITIAL_CENTER,
  radiusKm: INITIAL_RADIUS_KM,
  ready: false,
  moving: false,
  mapFailed: false,
};

export function useSpotSearch() {
  const client = useQueryClient();
  const [state, setState] = useState(initialState);
  // Googleのイベントが同じ描画の間に連続しても、直前の条件で判定する。
  const current = useRef(state);
  const query = useQuery({
    ...nearbySpotsOptions(state.searchCenter, state.radiusKm),
    // 通信の開始は初回idle・条件変更・再試行だけ。キャッシュと取得状態は購読する。
    enabled: false,
  });

  const update = useCallback((next: typeof initialState) => {
    current.current = next;
    setState(next);
  }, []);

  const cancelSearch = useCallback(() => {
    const { searchCenter, radiusKm } = current.current;
    void client.cancelQueries({
      queryKey: nearbySpotsOptions(searchCenter, radiusKm).queryKey,
      exact: true,
    });
  }, [client]);

  function search(center: Center, radiusKm: number) {
    update({
      ...current.current,
      center,
      searchCenter: center,
      radiusKm,
      ready: true,
      moving: false,
    });
    // fetchQueryは同一条件の通信をまとめ、鮮度内の結果があれば通信せず返す。
    // 失敗はqueryの状態から表示するため、イベントのPromiseには伝播させない。
    void client
      .fetchQuery(nearbySpotsOptions(center, radiusKm))
      .catch(() => {});
  }

  function centerChanged(center: Center) {
    if (current.current.mapFailed || sameCenter(center, current.current.center))
      return;
    cancelSearch();
    update({ ...current.current, center, moving: true });
  }

  function idle(center: Center) {
    const previous = current.current;
    if (previous.mapFailed) return;
    if (
      previous.ready &&
      !previous.moving &&
      sameCenter(center, previous.searchCenter)
    )
      return;

    if (!sameCenter(center, previous.center)) cancelSearch();
    search(center, previous.radiusKm);
  }

  function applyRadius(radiusKm: number) {
    const previous = current.current;
    if (radiusKm === previous.radiusKm) return;
    cancelSearch();
    if (!previous.ready || previous.moving || previous.mapFailed) {
      update({ ...previous, radiusKm });
      return;
    }
    search(previous.center, radiusKm);
  }

  // APIProviderはonErrorの変更でもローダーを実行するため、参照を固定する。
  const failMap = useCallback(() => {
    if (current.current.mapFailed) return;
    cancelSearch();
    update({ ...current.current, mapFailed: true });
  }, [cancelSearch, update]);

  function retry() {
    const previous = current.current;
    if (previous.ready && !previous.moving && !previous.mapFailed) {
      void query.refetch();
    }
  }

  const canShowResults =
    state.ready && !state.moving && !state.mapFailed && !query.isFetching;

  return {
    ...state,
    spots: canShowResults && query.isSuccess ? query.data : undefined,
    searchFailed: canShowResults && query.isError,
    centerChanged,
    idle,
    applyRadius,
    failMap,
    retry,
  };
}
