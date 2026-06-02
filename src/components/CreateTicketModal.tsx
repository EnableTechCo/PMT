"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, X } from "lucide-react";
import { SelectMenu } from "@/components/SelectMenu";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email: string;
  isInvited: boolean;
}

interface ProjectOption {
  id: string;
  name: string;
  teamId?: string | null;
  clientId?: string | null;
  githubRepos?: Array<{
    id: string;
    owner: string;
    name: string;
    url: string;
  }>;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  defaultTeamId: string;
  teams?: { id: string; name: string }[];
}

const statusOptions = [
  { value: "BACKLOG", label: "Backlog", color: "bg-gray-500" },
  { value: "TODO", label: "To Do", color: "bg-slate-500" },
  { value: "REFINE", label: "Refine", color: "bg-indigo-500" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-500" },
  { value: "REVISIONS", label: "REVIEW", color: "bg-yellow-500" },
  { value: "COMPLETE", label: "Complete", color: "bg-green-500" },
  { value: "CLIENT_REVIEW", label: "Client Review", color: "bg-brand-600" },
];

const priorityOptions = [
  { value: "NONE", label: "None" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

export default function CreateTicketModal({
  isOpen,
  defaultTeamId,
  teams = [],
}: CreateTicketModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    status: "BACKLOG",
    clientId: "",
    teamId: "",
    projectId: "",
    assigneeId: "",
    description: "",
    acceptanceCriteria: "",
    priority: "MEDIUM",
    startDate: "",
    dueDate: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [assignees, setAssignees] = useState<{ id: string; name: string }[]>(
    [],
  );
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    void fetchInvitedClients();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const initialTeamId =
      defaultTeamId || (teams.length === 1 ? teams[0].id : teams[0]?.id || "");
    setFormData((prev) => ({
      ...prev,
      teamId: initialTeamId,
      projectId: "",
      assigneeId: "",
    }));
  }, [isOpen, defaultTeamId, teams]);

  useEffect(() => {
    if (!formData.teamId) {
      setAssignees([]);
      return;
    }

    let canceled = false;

    const loadTeamMembers = async () => {
      setIsLoadingAssignees(true);
      try {
        const res = await fetch(`/api/teams/${formData.teamId}/members`);
        if (!res.ok) return;
        const data = await res.json();
        if (canceled) return;
        setAssignees(Array.isArray(data.members) ? data.members : []);
      } catch (error) {
        console.error("Failed to load assignees:", error);
      } finally {
        if (!canceled) setIsLoadingAssignees(false);
      }
    };

    void loadTeamMembers();

    return () => {
      canceled = true;
    };
  }, [formData.teamId]);

  useEffect(() => {
    if (!formData.clientId) {
      setProjects([]);
      setFormData((prev) => ({ ...prev, projectId: "" }));
      setIsLoadingProjects(false);
      return;
    }

    let canceled = false;

    const loadClientProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const res = await fetch(`/api/clients/${formData.clientId}/projects`);
        if (!res.ok) {
          if (!canceled) setProjects([]);
          return;
        }
        const data = (await res.json()) as ProjectOption[];
        if (canceled) return;
        setProjects(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load client projects:", error);
        if (!canceled) setProjects([]);
      } finally {
        if (!canceled) setIsLoadingProjects(false);
      }
    };

    void loadClientProjects();

    return () => {
      canceled = true;
    };
  }, [formData.clientId]);

  const fetchInvitedClients = async () => {
    setIsLoadingClients(true);
    try {
      const response = await fetch("/api/clients");
      if (!response.ok) return;
      const allClients = await response.json();
      const invitedClients = (allClients as Client[]).filter(
        (client) => client.isInvited,
      );
      setClients(invitedClients);
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: "",
      status: "BACKLOG",
      clientId: "",
      teamId: defaultTeamId || teams[0]?.id || "",
      projectId: "",
      assigneeId: "",
      description: "",
      acceptanceCriteria: "",
      priority: "MEDIUM",
      startDate: "",
      dueDate: "",
    });
    setProjects([]);
    setAssignees([]);
    window.dispatchEvent(new CustomEvent("create-ticket-modal-close"));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      window.dispatchEvent(
        new CustomEvent("create-ticket-modal-submit", { detail: formData }),
      );
      handleClose();
    } catch (error) {
      console.error("Failed to create ticket:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const projectsForSelectedClient = formData.teamId
    ? projects.filter(
        (project) => !project.teamId || project.teamId === formData.teamId,
      )
    : projects;

  const selectedProject = projectsForSelectedClient.find(
    (project) => project.id === formData.projectId,
  );

  const selectedProjectRepos = selectedProject?.githubRepos ?? [];
  const canSelectProject = Boolean(formData.teamId && formData.clientId);
  const hasSelectedProject = Boolean(formData.projectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/95 shadow-2xl backdrop-blur-xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-slate-800 p-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 shadow-sm">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Create New Ticket
              </h2>
              <p className="text-sm text-slate-400">
                Add a new task to your project
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-slate-700 p-3 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Ticket Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="Enter ticket title..."
              className="w-full rounded-none border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {(teams.length > 1 || !defaultTeamId) && teams.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Team *
              </label>
              <SelectMenu
                value={formData.teamId}
                onChange={(teamId) => {
                  setFormData((prev) => ({ ...prev, teamId, projectId: "" }));
                }}
                options={[
                  { value: "", label: "Select team..." },
                  ...teams.map((team) => ({
                    value: team.id,
                    label: team.name,
                  })),
                ]}
                className="w-full"
                triggerClassName="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-brand-500 focus:ring-brand-500/20"
                menuClassName="bg-[#0f1116] text-slate-100"
              />
            </div>
          )}

          {formData.teamId && hasSelectedProject && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Assignee
              </label>
              <SelectMenu
                value={formData.assigneeId}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    assigneeId: value,
                  }))
                }
                options={
                  isLoadingAssignees
                    ? [
                        {
                          value: "",
                          label: "Loading assignees...",
                          disabled: true,
                        },
                      ]
                    : [
                        { value: "", label: "Unassigned" },
                        ...assignees.map((member) => ({
                          value: member.id,
                          label: member.name,
                        })),
                      ]
                }
                disabled={isLoadingAssignees}
                className="w-full"
                triggerClassName="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-brand-500 focus:ring-brand-500/20"
                menuClassName="bg-[#0f1116] text-slate-100"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Client (Optional)
            </label>
            <SelectMenu
              value={formData.clientId}
              onChange={(value) =>
                setFormData((prev) => ({
                  ...prev,
                  clientId: value,
                  projectId: "",
                }))
              }
              options={
                isLoadingClients
                  ? [{ value: "", label: "Loading clients...", disabled: true }]
                  : clients.length === 0
                    ? [
                        {
                          value: "",
                          label: "No invited clients available",
                          disabled: true,
                        },
                      ]
                    : [
                        { value: "", label: "No client selected" },
                        ...clients.map((client) => ({
                          value: client.id,
                          label: `${client.name} • ${client.email}`,
                        })),
                      ]
              }
              disabled={isLoadingClients || clients.length === 0}
              placeholder="No client selected"
              className="w-full"
              triggerClassName="rounded-none border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-brand-500 focus:ring-brand-500/20"
              menuClassName="bg-[#0f1116] text-slate-100"
            />
            {!formData.clientId ? (
              <p className="mt-2 text-xs text-slate-400">
                You can create a ticket without linking a client.
              </p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Project (From selected client)
            </label>
            <SelectMenu
              value={formData.projectId}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, projectId: value }))
              }
              disabled={!canSelectProject || isLoadingProjects}
              options={
                !canSelectProject
                  ? [
                      {
                        value: "",
                        label: "Select a client to link a project (optional)",
                      },
                    ]
                  : isLoadingProjects
                    ? [
                        {
                          value: "",
                          label: "Loading projects...",
                          disabled: true,
                        },
                      ]
                    : [
                        { value: "", label: "Select project..." },
                        ...projectsForSelectedClient.map((project) => ({
                          value: project.id,
                          label: project.name,
                        })),
                      ]
              }
              className="w-full"
              triggerClassName="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-brand-500 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              menuClassName="bg-[#0f1116] text-slate-100"
            />

            {formData.clientId &&
            !isLoadingProjects &&
            projectsForSelectedClient.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">
                No projects found for this client in the selected team.
              </p>
            ) : null}

            {selectedProject ? (
              <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-600/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-200">
                  Repo context inherited from project
                </p>
                {selectedProjectRepos.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProjectRepos.map((repo) => (
                      <span
                        key={repo.id}
                        className="rounded-md border border-brand-400/40 bg-slate-900/70 px-2 py-1 text-xs text-slate-100"
                      >
                        {repo.owner}/{repo.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-300">
                    This project has no linked GitHub repos yet.
                  </p>
                )}
              </div>
            ) : null}

            {!hasSelectedProject ? (
              <p className="mt-2 text-xs text-slate-400">
                Select a project to continue with additional ticket details.
              </p>
            ) : null}
          </div>

          {hasSelectedProject && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Describe the ticket details..."
                  rows={4}
                  className="w-full resize-none rounded-none border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Acceptance Criteria (QA)
                </label>
                <textarea
                  value={formData.acceptanceCriteria}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      acceptanceCriteria: e.target.value,
                    }))
                  }
                  placeholder="List clear acceptance criteria for QA validation..."
                  rows={4}
                  className="w-full resize-none rounded-none border border-slate-700 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Priority
                </label>
                <SelectMenu
                  value={formData.priority}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: value,
                    }))
                  }
                  options={priorityOptions.map((priority) => ({
                    value: priority.value,
                    label: priority.label,
                  }))}
                  className="w-full"
                  triggerClassName="rounded-none border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus:border-brand-500 focus:ring-brand-500/20"
                  menuClassName="bg-[#0f1116] text-slate-100"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Start date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start rounded-none px-4 py-3 text-left font-normal",
                          !formData.startDate && "text-slate-400",
                        )}
                      >
                        {formData.startDate
                          ? format(new Date(formData.startDate), "PPP")
                          : "Pick a start date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          formData.startDate
                            ? new Date(formData.startDate)
                            : undefined
                        }
                        onSelect={(date) => {
                          setFormData((prev) => ({
                            ...prev,
                            startDate: date ? date.toISOString() : "",
                          }));
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Due date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start rounded-none px-4 py-3 text-left font-normal",
                          !formData.dueDate && "text-slate-400",
                        )}
                      >
                        {formData.dueDate
                          ? format(new Date(formData.dueDate), "PPP")
                          : "Pick a due date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          formData.dueDate
                            ? new Date(formData.dueDate)
                            : undefined
                        }
                        onSelect={(date) => {
                          setFormData((prev) => ({
                            ...prev,
                            dueDate: date ? date.toISOString() : "",
                          }));
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          status: option.value,
                        }))
                      }
                      className={cn(
                        "flex items-center space-x-2 rounded-lg border p-3 transition-all duration-200",
                        formData.status === option.value
                          ? "border-brand-500 bg-brand-600/10 text-brand-200"
                          : "border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-600 hover:bg-slate-800",
                      )}
                    >
                      <div
                        className={cn("h-3 w-3 rounded-full", option.color)}
                      />
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center justify-end space-x-3 border-t border-slate-700 pt-6">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting || !formData.title.trim() || !formData.teamId
              }
              className={cn(
                "btn-primary",
                (isSubmitting || !formData.title.trim() || !formData.teamId) &&
                  "cursor-not-allowed opacity-50",
              )}
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                  <span>Creating...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>Create Ticket</span>
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
