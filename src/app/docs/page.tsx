"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import { FileText, Plus, Clock, User, X } from "lucide-react";
import { onRealtimeChange } from "@/lib/realtime-events";

interface Document {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
}

export default function DocsPage() {
  const router = useRouter();
  const { activeTeamId, isAllTeams } = useTeam();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [createDocError, setCreateDocError] = useState("");
  const [creatingDoc, setCreatingDoc] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const url =
        activeTeamId && !isAllTeams
          ? `/api/docs?teamId=${activeTeamId}`
          : `/api/docs`;
      const res = await fetch(url);
      if (res.ok) {
        setDocs(await res.json());
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [activeTeamId, isAllTeams]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    const unsubscribe = onRealtimeChange((detail) => {
      if (detail.table !== "Document") return;
      void fetchDocs();
    });

    return unsubscribe;
  }, [fetchDocs]);

  const createDoc = async () => {
    const title = newDocTitle.trim();
    if (!title) {
      setCreateDocError("Document title is required.");
      return;
    }

    const teamId = activeTeamId;
    if (isAllTeams || !teamId) {
      setCreateDocError(
        "Please select a specific team first to create a document.",
      );
      return;
    }

    try {
      setCreatingDoc(true);
      setCreateDocError("");
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: "# " + title, teamId }),
      });
      if (res.ok) {
        const newDoc = await res.json();
        setShowCreateModal(false);
        setNewDocTitle("");
        router.push(`/docs/${newDoc.id}`);
        return;
      }

      const body = await res.json().catch(() => ({}));
      setCreateDocError(
        typeof body.error === "string"
          ? body.error
          : "Failed to create document.",
      );
    } catch (e) {
      console.error(e);
      setCreateDocError("Failed to create document.");
    } finally {
      setCreatingDoc(false);
    }
  };

  const filteredDocs = docs.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <div className="w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Team Docs
            </h1>
            <p className="text-gray-500 mt-1">
              Internal knowledge base, specifications, and notes
            </p>
          </div>

          <button
            onClick={() => {
              setCreateDocError("");
              setShowCreateModal(true);
            }}
            className="btn-primary shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 input-modern"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 bg-gray-100 dark:bg-gray-800 rounded-xl"
              ></div>
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#1c1c24] rounded-xl border border-gray-200 dark:border-gray-800">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
              No documents found
            </h3>
            <p className="text-gray-500">
              Create a new document to start building your knowledge base.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => router.push(`/docs/${doc.id}`)}
                className="flex flex-col p-5 bg-white dark:bg-[#1c1c24] border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-md hover:border-brand-500/30 transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-brand-50 dark:bg-brand-500/10 rounded-lg text-brand-600 dark:text-brand-400">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-brand-600 transition-colors line-clamp-2">
                  {doc.title}
                </h3>

                <div className="mt-auto pt-4 flex flex-col gap-2 text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    <span>{doc.author?.name ?? "Unknown author"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {doc.project && (
                    <div className="inline-flex items-center self-start mt-1 px-2 py-1 rounded text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      Project: {doc.project.name}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (creatingDoc) return;
              setShowCreateModal(false);
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-[#1c1c24]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                New Document
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (creatingDoc) return;
                  setShowCreateModal(false);
                }}
                className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Title
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-brand-500 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
                  placeholder="Enter document title"
                  autoFocus
                />
              </div>

              {createDocError ? (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                  {createDocError}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/5"
                  disabled={creatingDoc}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void createDoc();
                  }}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  disabled={creatingDoc}
                >
                  {creatingDoc ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
