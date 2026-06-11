"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  MoreHorizontal,
  Clock,
  CheckCircle,
  AlertCircle,
  Zap,
  Eye,
  Tag,
  GripVertical,
  ListTodo,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  selectorId?: number | null;
  title: string;
  status: string;
  priority?: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    email: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  client?: {
    id: string;
    name: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
  } | null;
  project?: {
    id: string;
    name: string;
    client?: {
      id: string;
      name: string;
      email: string;
    } | null;
  } | null;
}

function ticketDisplayId(ticket: Ticket): string {
  if (typeof ticket.selectorId === "number") {
    return `#${ticket.selectorId}`;
  }
  return "No selector ID";
}

interface KanbanBoardProps {
  tickets: Ticket[];
  onStatusChange: (ticketId: string, newStatus: string) => void;
  onTicketClick: (ticket: Ticket) => void;
  userRole: string;
  onCreateTicket: () => void;
}

const statusConfig = {
  BACKLOG: {
    label: "Backlog",
    color: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    icon: Clock,
    bgColor: "bg-gray-500/10",
  },
  TODO: {
    label: "To Do",
    color:
      "bg-slate-500/20 text-slate-500 dark:text-slate-400 border-slate-500/30",
    icon: ListTodo,
    bgColor: "bg-slate-500/10",
  },
  REFINE: {
    label: "Refine",
    color:
      "bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 border-indigo-500/30",
    icon: Filter,
    bgColor: "bg-indigo-500/10",
  },
  IN_PROGRESS: {
    label: "In Progress",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: Zap,
    bgColor: "bg-blue-500/10",
  },
  IN_REVIEW: {
    label: "In Review",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    icon: Eye,
    bgColor: "bg-cyan-500/10",
  },
  QA: {
    label: "QA",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    icon: AlertCircle,
    bgColor: "bg-orange-500/10",
  },
  REVISIONS: {
    label: "Revisions",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: AlertCircle,
    bgColor: "bg-yellow-500/10",
  },
  COMPLETE: {
    label: "Complete",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: CheckCircle,
    bgColor: "bg-green-500/10",
  },
  CLIENT_REVIEW: {
    label: "Client Review",
    color:
      "bg-brand-500/15 text-brand-700 border border-brand-500/25 dark:text-brand-300 dark:border-brand-500/30",
    icon: Eye,
    bgColor: "bg-brand-500/10",
  },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
  LOW: {
    label: "Low",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
  },
  MEDIUM: {
    label: "Medium",
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
  },
  HIGH: {
    label: "High",
    className:
      "bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20",
  },
  URGENT: {
    label: "Urgent",
    className:
      "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20",
  },
  NONE: {
    label: "None",
    className:
      "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20",
  },
};

function getPriorityDisplay(priority?: string | null) {
  const normalized = (priority ?? "NONE").toUpperCase();
  return priorityConfig[normalized] ?? priorityConfig.NONE;
}

function SortableTicket({
  ticket,
  onClick,
}: {
  ticket: Ticket;
  onClick: () => void;
}) {
  const priority = getPriorityDisplay(ticket.priority);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 shadow-card transition-shadow hover:shadow-card-hover dark:border-gray-800 dark:bg-[#1c1c24] w-full max-w-full",
        isDragging && "opacity-75 scale-105 shadow-2xl",
      )}
    >
      <button
        type="button"
        className="mt-0.5 flex h-8 w-6 shrink-0 cursor-grab touch-none items-start justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing dark:hover:bg-white/10 dark:hover:text-gray-900"
        aria-label="Drag to move ticket"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div
        role="button"
        tabIndex={0}
        className="min-w-0 flex-1 cursor-pointer text-left"
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
              {ticketDisplayId(ticket)}
            </p>
            <h4 className="line-clamp-2 min-h-10 text-sm font-medium normal-case leading-5 text-slate-900 dark:text-white">
              {ticket.title}
            </h4>
          </div>
          <button
            type="button"
            className="shrink-0 text-gray-400 opacity-0 transition-opacity hover:text-gray-700 group-hover:opacity-100 dark:hover:text-gray-300"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
              {ticket.project?.name || "No project"}
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                priority.className,
              )}
            >
              {priority.label}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              {ticket.assignee?.name || "No assignee"}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(ticket.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraggedTicket({ ticket }: { ticket: Ticket }) {
  const priority = getPriorityDisplay(ticket.priority);

  return (
    <div className="w-full max-w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {ticketDisplayId(ticket)}
          </p>
          <h4 className="line-clamp-2 min-h-10 text-sm font-medium leading-5 text-slate-900 dark:text-white">
            {ticket.title}
          </h4>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate">
            {ticket.project?.name || "No project"}
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              priority.className,
            )}
          >
            {priority.label}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-gray-500 text-xs">
            {ticket.client?.name || ticket.project?.client?.name}
          </div>
          <div className="text-gray-500 text-xs">
            {new Date(ticket.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function DroppableColumn({
  status,
  children,
}: {
  status: string;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className="h-full min-w-[350px] w-[360px] shrink-0 snap-start"
    >
      {children}
    </div>
  );
}

export default function KanbanBoard({
  tickets,
  onStatusChange,
  onTicketClick,
  userRole,
  onCreateTicket,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const boardResetKey = useMemo(
    () => tickets.map((ticket) => `${ticket.id}:${ticket.status}`).join("|"),
    [tickets],
  );

  useEffect(() => {
    const scroller = boardScrollRef.current;
    if (!scroller) return;

    // Keep the board anchored to the first column after data refreshes.
    requestAnimationFrame(() => {
      scroller.scrollTo({ left: 0, behavior: "auto" });
    });
  }, [boardResetKey]);

  const groupedTickets = tickets.reduce(
    (acc, ticket) => {
      if (!acc[ticket.status]) {
        acc[ticket.status] = [];
      }
      acc[ticket.status].push(ticket);
      return acc;
    },
    {} as Record<string, Ticket[]>,
  );

  Object.keys(statusConfig).forEach((status) => {
    if (!groupedTickets[status]) {
      groupedTickets[status] = [];
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    let currentStatus = "";
    Object.entries(groupedTickets).forEach(([status, tickets]) => {
      if (tickets.find((t) => t.id === activeId)) {
        currentStatus = status;
      }
    });

    let targetStatus = "";

    if (Object.keys(statusConfig).includes(overId)) {
      targetStatus = overId;
    } else {
      Object.entries(groupedTickets).forEach(([status, columnTickets]) => {
        if (columnTickets.some((ticket) => ticket.id === overId)) {
          targetStatus = status;
        }
      });
    }

    if (targetStatus && currentStatus !== targetStatus) {
      onStatusChange(activeId, targetStatus);
    }
  };

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        ref={boardScrollRef}
        className="hover-scrollbar flex gap-6 overflow-x-auto pb-6 snap-x"
      >
        {Object.entries(groupedTickets).map(([status, tickets]) => {
          const config = statusConfig[status as keyof typeof statusConfig];
          const StatusIcon = config.icon;

          return (
            <DroppableColumn key={status} status={status}>
              <div className="min-h-[600px] rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] shadow-card dark:border-gray-800 dark:bg-[#1c1c24]">
                <div className="border-b border-[var(--border)] p-4 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={cn("p-1 rounded-lg", config.bgColor)}>
                        <StatusIcon className="w-4 h-4" />
                      </div>
                      <h3 className="text-slate-900 dark:text-gray-100 font-semibold text-sm">
                        {config.label}
                      </h3>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 tabular-nums dark:bg-white/10 dark:text-gray-300">
                      {tickets.length}
                    </span>
                  </div>

                  {(userRole === "USER" || userRole === "SUPER_ADMIN") && (
                    <button
                      onClick={onCreateTicket}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-md p-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/40"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add ticket</span>
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                  <SortableContext
                    items={tickets.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tickets.map((ticket) => (
                      <SortableTicket
                        key={ticket.id}
                        ticket={ticket}
                        onClick={() => onTicketClick(ticket)}
                      />
                    ))}
                  </SortableContext>

                  {tickets.length === 0 && (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <Tag className="w-4 h-4 text-gray-500" />
                      </div>
                      No tickets
                    </div>
                  )}
                </div>
              </div>
            </DroppableColumn>
          );
        })}
      </div>

      <DragOverlay>
        {activeTicket ? <DraggedTicket ticket={activeTicket} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
