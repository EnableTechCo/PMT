import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import type { AppNotification, LoadingStatus } from "@/store/types";

const NOTIFICATION_STALE_MS = 30_000;

type NotificationsState = {
  items: AppNotification[];
  status: LoadingStatus;
  error: string | null;
  fetchedAt: number | null;
};

const initialState: NotificationsState = {
  items: [],
  status: "idle",
  error: null,
  fetchedAt: null,
};

export const fetchNotifications = createAsyncThunk<
  AppNotification[],
  { force?: boolean } | undefined,
  { state: RootState }
>(
  "notifications/fetch",
  async () => {
    const res = await fetch("/api/notifications");
    if (!res.ok) throw new Error("Failed to fetch notifications");
    const data = (await res.json()) as AppNotification[];
    return Array.isArray(data) ? data : [];
  },
  {
    condition: (arg, api) => {
      const force = Boolean(arg?.force);
      if (force) return true;
      const state = api.getState().notifications;
      if (state.status === "loading") return false;
      if (!state.fetchedAt) return true;
      return Date.now() - state.fetchedAt > NOTIFICATION_STALE_MS;
    },
  },
);

export const markNotificationsRead = createAsyncThunk<
  string[],
  string[],
  { state: RootState }
>("notifications/markRead", async (ids) => {
  if (ids.length === 0) return [];
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to mark notifications read");
  return ids;
});

export const markAllNotificationsRead = createAsyncThunk<
  boolean,
  void,
  { state: RootState }
>("notifications/markAllRead", async () => {
  const res = await fetch("/api/notifications", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markAllRead: true }),
  });
  if (!res.ok) throw new Error("Failed to mark all notifications read");
  return true;
});

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    invalidateNotifications(state) {
      state.fetchedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
        state.error = null;
        state.fetchedAt = Date.now();
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || "Failed to load notifications";
      })
      .addCase(markNotificationsRead.fulfilled, (state, action) => {
        const idSet = new Set(action.payload);
        state.items = state.items.map((item) =>
          idSet.has(item.id) ? { ...item, read: true } : item,
        );
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((item) => ({ ...item, read: true }));
      });
  },
});

export const { invalidateNotifications } = notificationsSlice.actions;

export const selectNotifications = (state: RootState) =>
  state.notifications.items;
export const selectNotificationsStatus = (state: RootState) =>
  state.notifications.status;

export default notificationsSlice.reducer;
