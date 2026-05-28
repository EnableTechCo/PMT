"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import DashboardLayout from "@/components/DashboardLayout";
import { FileText, Plus, Search, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { onRealtimeChange } from "@/lib/realtime-events";

interface Document {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
  team: { id: string; name: string };
  project?: { id: string; name: string };
}

export default function DocsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeTeamId, isAllTeams } = useTeam();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchDocs();
  }, [activeTeamId, isAllTeams]);

  useEffect(() => {
    const unsubscribe = onRealtimeChange((detail) => {
      if (detail.table !== "Document") return;
      void fetchDocs();
    });

    return unsubscribe;
  }, [activeTeamId, isAllTeams]);

  const fetchDocs = async () => {
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
  };

  const createDoc = async () => {
    const title = prompt("Enter document title:");
    if (!title) return;

    let teamId = activeTeamId;
    if (isAllTeams || !teamId) {
      alert("Please select a specific team first to create a document.");
      return;
    }

    try {
      const res = await fetch("/api/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: "# " + title, teamId }),
      });
      if (res.ok) {
        const newDoc = await res.json();
        router.push(`/docs/${newDoc.id}`);
      }
    } catch (e) {
      console.error(e);
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
            onClick={createDoc}
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
                    <span>{doc.author.name}</span>
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
    </DashboardLayout>
  );
}
