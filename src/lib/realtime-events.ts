"use client";

import type { RealtimeChangeDetail } from "@/contexts/RealtimeContext";

export function onRealtimeChange(
  handler: (detail: RealtimeChangeDetail) => void,
) {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<RealtimeChangeDetail>;
    if (!customEvent.detail) return;
    handler(customEvent.detail);
  };

  window.addEventListener("app:realtime-change", listener as EventListener);

  return () => {
    window.removeEventListener(
      "app:realtime-change",
      listener as EventListener,
    );
  };
}
