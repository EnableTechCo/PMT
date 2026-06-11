export const Role = {
  USER: "USER",
  CLIENT: "CLIENT",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const TicketStatus = {
  BACKLOG: "BACKLOG",
  TODO: "TODO",
  REFINE: "REFINE",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  QA: "QA",
  REVISIONS: "REVISIONS",
  CLIENT_REVIEW: "CLIENT_REVIEW",
  COMPLETE: "COMPLETE",
} as const;

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  NONE: "NONE",
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;

export type TicketPriority =
  (typeof TicketPriority)[keyof typeof TicketPriority];

export const ProjectStatus = {
  PLANNING: "PLANNING",
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETE: "COMPLETE",
  ARCHIVED: "ARCHIVED",
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ProjectHealth = {
  GREEN: "GREEN",
  AMBER: "AMBER",
  RED: "RED",
} as const;

export type ProjectHealth = (typeof ProjectHealth)[keyof typeof ProjectHealth];

export const SprintStatus = {
  PLANNED: "PLANNED",
  ACTIVE: "ACTIVE",
  COMPLETED: "COMPLETED",
  CLOSED: "CLOSED",
} as const;

export type SprintStatus = (typeof SprintStatus)[keyof typeof SprintStatus];

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  phone: string | null;
  role: Role;
  teamId: string | null;
  githubToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  isInvited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sprint {
  id: string;
  teamId: string;
  projectId: string | null;
  createdById: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startsAt: Date;
  endsAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const ClientObligationStatus = {
  PENDING: "PENDING",
  SUBMITTED: "SUBMITTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  OVERDUE: "OVERDUE",
} as const;

export type ClientObligationStatus =
  (typeof ClientObligationStatus)[keyof typeof ClientObligationStatus];

export interface ClientObligation {
  id: string;
  ticketId: string;
  title: string;
  description: string | null;
  status: ClientObligationStatus;
  dueAt: Date | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  evidenceUrl: string | null;
  evidenceNote: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ClientFeedbackStatus = {
  NEW: "NEW",
  TRIAGED: "TRIAGED",
  ASSIGNED: "ASSIGNED",
  RESOLVED: "RESOLVED",
} as const;

export type ClientFeedbackStatus =
  (typeof ClientFeedbackStatus)[keyof typeof ClientFeedbackStatus];

export interface ClientFeedback {
  id: string;
  source: string;
  status: ClientFeedbackStatus;
  fromEmail: string;
  subject: string;
  body: string;
  clientId: string | null;
  ticketId: string | null;
  teamId: string | null;
  assignedToId: string | null;
  assignedAt: Date | null;
  attachmentJson: string | null;
  rawPayload: string | null;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
