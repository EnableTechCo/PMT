import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { LoadingStatus } from "@/store/types";

export type CachedResource<T = unknown> = {
  data: T | null;
  status: LoadingStatus;
  error: string | null;
  fetchedAt: number | null;
};

type ResourceCacheState = {
  byKey: Record<string, CachedResource>;
};

const initialState: ResourceCacheState = {
  byKey: {},
};

type SetPendingPayload = { key: string };
type SetSuccessPayload<T = unknown> = { key: string; data: T };
type SetFailedPayload = { key: string; error: string };

const resourceCacheSlice = createSlice({
  name: "resourceCache",
  initialState,
  reducers: {
    setResourcePending(state, action: PayloadAction<SetPendingPayload>) {
      const { key } = action.payload;
      state.byKey[key] = {
        data: state.byKey[key]?.data ?? null,
        status: "loading",
        error: null,
        fetchedAt: state.byKey[key]?.fetchedAt ?? null,
      };
    },
    setResourceSuccess(state, action: PayloadAction<SetSuccessPayload>) {
      const { key, data } = action.payload;
      state.byKey[key] = {
        data,
        status: "succeeded",
        error: null,
        fetchedAt: Date.now(),
      };
    },
    setResourceFailed(state, action: PayloadAction<SetFailedPayload>) {
      const { key, error } = action.payload;
      state.byKey[key] = {
        data: state.byKey[key]?.data ?? null,
        status: "failed",
        error,
        fetchedAt: state.byKey[key]?.fetchedAt ?? null,
      };
    },
    invalidateResource(state, action: PayloadAction<{ key: string }>) {
      const { key } = action.payload;
      if (!state.byKey[key]) return;
      state.byKey[key].fetchedAt = null;
    },
    invalidateResources(state, action: PayloadAction<{ keys: string[] }>) {
      for (const key of action.payload.keys) {
        if (!state.byKey[key]) continue;
        state.byKey[key].fetchedAt = null;
      }
    },
  },
});

export const {
  setResourcePending,
  setResourceSuccess,
  setResourceFailed,
  invalidateResource,
  invalidateResources,
} = resourceCacheSlice.actions;

export default resourceCacheSlice.reducer;
