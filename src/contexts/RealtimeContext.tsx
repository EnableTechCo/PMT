"use client";

import React, { createContext, useContext, useEffect, useMemo } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type RealtimeTable =
  | "Ticket"
  | "Project"
  | "Client"
  | "Milestone"
  | "Notification"
  | "Team"
  | "TeamMembership"
  | "Portfolio"
  | "GithubRepo"
  | "GithubBranch"
  | "GithubPullRequest"
  | "Document";

export interface RealtimeChangeDetail {
  table: RealtimeTable;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  payload: unknown;
}

interface RealtimeContextValue {
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(
  undefined,
);

const REALTIME_TABLES: RealtimeTable[] = [
  "Ticket",
  "Project",
  "Client",
  "Milestone",
  "Notification",
  "Team",
  "TeamMembership",
  "Portfolio",
  "GithubRepo",
  "GithubBranch",
  "GithubPullRequest",
  "Document",
];

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      return;
    }

    const channelName = `global-realtime:${user.id}`;
    const channel: RealtimeChannel = supabaseClient.channel(channelName);

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        (payload) => {
          const detail: RealtimeChangeDetail = {
            table,
            eventType: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            payload,
          };

          window.dispatchEvent(
            new CustomEvent<RealtimeChangeDetail>("app:realtime-change", {
              detail,
            }),
          );

          if (table === "Notification") {
            window.dispatchEvent(new Event("app:notification-change"));
          }
        },
      );
    }

    channel.subscribe((status) => {
      window.dispatchEvent(
        new CustomEvent("app:realtime-status", {
          detail: { status },
        }),
      );
    });

    return () => {
      void supabaseClient.removeChannel(channel);
    };
  }, [user]);

  const value = useMemo(() => ({ connected: Boolean(user) }), [user]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error("useRealtime must be used within a RealtimeProvider");
  }
  return context;
}
