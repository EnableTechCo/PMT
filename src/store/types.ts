export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  ticketId: string | null;
  read: boolean;
  createdAt: string;
}

export type LoadingStatus = "idle" | "loading" | "succeeded" | "failed";
