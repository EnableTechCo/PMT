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

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
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
