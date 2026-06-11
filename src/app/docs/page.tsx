"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ArrowUpRight,
  ChevronRight,
  Plus,
  Search,
  X,
} from "lucide-react";
import { onRealtimeChange } from "@/lib/realtime-events";

type AuthoredDoc = {
  id: string;
  kind: "authored-doc";
  title: string;
  contentHtml: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string } | null;
  team: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
};

type RepoReadme = {
  id: string;
  kind: "repo-readme";
  title: string;
  summary: string;
  contentHtml: string;
  owner: string;
  repo: string;
  url: string;
  updatedAt: string | null;
  project?: { id: string; name: string } | null;
};

type DocsLibraryResponse = {
  authoredDocs: AuthoredDoc[];
  repoReadmes: RepoReadme[];
};

type LibraryItem = AuthoredDoc | RepoReadme;

function itemSearchText(item: LibraryItem) {
  return [
    item.title,
    item.kind === "repo-readme" ? item.summary : item.author?.name,
    item.project?.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function DocsPage() {
  const router = useRouter();
  const { activeTeamId, isAllTeams } = useTeam();
  const [authoredDocs, setAuthoredDocs] = useState<AuthoredDoc[]>([]);
  const [repoReadmes, setRepoReadmes] = useState<RepoReadme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [createDocError, setCreateDocError] = useState("");
  const [creatingDoc, setCreatingDoc] = useState(false);

  const fetchDocsLibrary = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTeamId && !isAllTeams) {
        params.set("teamId", activeTeamId);
      }

      const response = await fetch(
        `/api/docs/library${params.toString() ? `?${params}` : ""}`,
      );

      if (!response.ok) {
        throw new Error("Failed to load docs library");
      }

      const data = (await response.json()) as DocsLibraryResponse;
      setAuthoredDocs(
        Array.isArray(data.authoredDocs) ? data.authoredDocs : [],
      );
      setRepoReadmes(Array.isArray(data.repoReadmes) ? data.repoReadmes : []);
    } catch (error) {
      console.error(error);
      setAuthoredDocs([]);
      setRepoReadmes([]);
    } finally {
      setLoading(false);
    }
  }, [activeTeamId, isAllTeams]);

  useEffect(() => {
    void fetchDocsLibrary();
  }, [fetchDocsLibrary]);

  useEffect(() => {
    const unsubscribe = onRealtimeChange((detail) => {
      if (detail.table !== "Document" && detail.table !== "GithubRepo") return;
      void fetchDocsLibrary();
    });

    return unsubscribe;
  }, [fetchDocsLibrary]);

  const filteredAuthoredDocs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return authoredDocs;
    return authoredDocs.filter((doc) => itemSearchText(doc).includes(query));
  }, [authoredDocs, searchQuery]);

  const filteredRepoReadmes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return repoReadmes;
    return repoReadmes.filter((doc) => itemSearchText(doc).includes(query));
  }, [repoReadmes, searchQuery]);

  const visibleItems = useMemo(
    () => [...filteredAuthoredDocs, ...filteredRepoReadmes],
    [filteredAuthoredDocs, filteredRepoReadmes],
  );

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  useEffect(() => {
    setPage(1);
  }, [searchQuery, activeTeamId, isAllTeams]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!visibleItems.length) {
      setSelectedId("");
      return;
    }

    if (!visibleItems.some((item) => item.id === selectedId)) {
      setSelectedId(visibleItems[0].id);
    }
  }, [visibleItems, selectedId]);

  const selectedItem =
    visibleItems.find((item) => item.id === selectedId) ?? null;

  const sidebarItemTitle = (item: LibraryItem) => {
    if (item.kind === "repo-readme") {
      return `${item.repo.replace(/\s+/g, "-").toLowerCase()}-README`;
    }
    return item.title;
  };

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
        body: JSON.stringify({ title, content: `<h1>${title}</h1>`, teamId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.error === "string"
            ? body.error
            : "Failed to create document.",
        );
      }

      const newDoc = await res.json();
      setShowCreateModal(false);
      setNewDocTitle("");
      router.push(`/docs/${newDoc.id}`);
    } catch (error) {
      setCreateDocError(
        error instanceof Error ? error.message : "Failed to create document.",
      );
    } finally {
      setCreatingDoc(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="w-full min-h-[calc(100vh-7rem)] overflow-hidden border border-[#d0d7de] bg-[#f6f8fa] text-[#24292f]">
        <header className="border-b border-[#d0d7de] bg-white px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative min-w-[280px] flex-1 sm:flex-none sm:w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c959f]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search articles"
                  className="w-full border border-[#d0d7de] bg-white py-2.5 pl-10 pr-4 text-sm text-[#24292f] outline-none transition focus:border-[#1f6feb]"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateDocError("");
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center justify-center gap-2 bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1a7f37]"
              >
                <Plus className="h-4 w-4" />
                New article
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-5 py-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden xl:block">
            <div className="sticky top-6 border border-[#d0d7de] bg-white">
              <div className="max-h-[calc(100vh-10rem)] overflow-y-auto px-2 py-2">
                <details
                  open
                  className="group border-b border-[#d8dee4] px-2 py-1 last:border-b-0"
                >
                  <summary className="cursor-pointer list-none py-1.5 text-md text-[#24292f] font-bold">
                    Docs
                  </summary>
                  <div className="pb-2">
                    {visibleItems.length ? (
                      visibleItems.map((item) => (
                        <button
                          key={`nav-item-${item.id}`}
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className={`mt-1 flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-left text-sm font-medium ${
                            selectedId === item.id
                              ? "border-brand-600 text-brand-600"
                              : "border-transparent text-[#57606a] hover:text-[#24292f]"
                          }`}
                          title={sidebarItemTitle(item)}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            {sidebarItemTitle(item)}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-current opacity-70" />
                        </button>
                      ))
                    ) : (
                      <p className="mt-1 px-2 py-1 text-xs text-[#57606a]">
                        No docs found.
                      </p>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            {!loading && selectedItem ? (
              <article className="border border-[#d0d7de] bg-white p-6 sm:p-8">
                <div className="mb-6 flex flex-col gap-4 border-b border-[#d0d7de] pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="mt-2 text-2xl font-semibold text-[#24292f]">
                      {selectedItem.title}
                    </h3>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedItem.kind === "authored-doc" ? (
                      <Link
                        href={`/docs/${selectedItem.id}`}
                        className="inline-flex items-center gap-2 border border-[#d0d7de] bg-white px-3 py-2 text-sm font-medium text-[#24292f] hover:bg-[#f6f8fa]"
                      >
                        Edit article
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    ) : (
                      <a
                        href={selectedItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 border border-[#d0d7de] bg-white px-3 py-2 text-sm font-medium text-[#24292f] hover:bg-[#f6f8fa]"
                      >
                        Open repository
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>

                <div
                  className="docs-prose max-w-none text-[15px] leading-7 text-[#24292f]"
                  dangerouslySetInnerHTML={{
                    __html:
                      selectedItem.contentHtml ||
                      "<p>No content available.</p>",
                  }}
                />
              </article>
            ) : null}
          </main>
        </div>
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
                New document
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
