import { store } from "@/store";
import {
  setResourceFailed,
  setResourcePending,
  setResourceSuccess,
} from "@/store/slices/resourceCacheSlice";

type CachedGetOptions = {
  key: string;
  url: string;
  staleMs?: number;
  force?: boolean;
  init?: RequestInit;
};

export async function cachedGetJson<T>({
  key,
  url,
  staleMs = 30_000,
  force = false,
  init,
}: CachedGetOptions): Promise<T> {
  const state = store.getState();
  const cached = state.resourceCache.byKey[key];

  const canUseCache =
    !force &&
    cached?.status === "succeeded" &&
    cached?.fetchedAt &&
    Date.now() - cached.fetchedAt < staleMs;

  if (canUseCache) {
    return cached.data as T;
  }

  store.dispatch(setResourcePending({ key }));

  try {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as T;

    if (!response.ok) {
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? String((body as { error?: string }).error || "Request failed")
          : "Request failed";
      throw new Error(message);
    }

    store.dispatch(setResourceSuccess({ key, data: body }));
    return body;
  } catch (error) {
    store.dispatch(
      setResourceFailed({
        key,
        error: error instanceof Error ? error.message : "Request failed",
      }),
    );
    throw error;
  }
}
