import { configureStore } from "@reduxjs/toolkit";
import notificationsReducer from "@/store/slices/notificationsSlice";
import resourceCacheReducer from "@/store/slices/resourceCacheSlice";

export const store = configureStore({
  reducer: {
    notifications: notificationsReducer,
    resourceCache: resourceCacheReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
