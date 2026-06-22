"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { onRealtimeChange } from "@/lib/realtime-events";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setResourceFailed,
  setResourcePending,
  setResourceSuccess,
} from "@/store/slices/resourceCacheSlice";

const STORAGE_KEY = "pm_tool_active_team_id";
const TEAMS_CACHE_KEY = "teams_list";
const TEAMS_STALE_MS = 300_000;

type Team = { id: string; name: string };

interface TeamContextValue {
  teams: Team[];
  activeTeamId: string;
  setActiveTeamId: (id: string) => void;
  loading: boolean;
  refreshTeams: () => Promise<void>;
  /** Super admin: true when viewing all teams (no team filter). */
  isAllTeams: boolean;
  setAllTeamsMode: (all: boolean) => void;
}

const TeamContext = createContext<TeamContextValue | undefined>(undefined);

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { user, loading: authLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamIdState] = useState("");
  const [allTeamsMode, setAllTeamsMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const teamsCache = useAppSelector(
    (state) => state.resourceCache.byKey[TEAMS_CACHE_KEY],
  );

  const refreshTeams = useCallback(
    async (options?: { force?: boolean }) => {
      const force = Boolean(options?.force);
      const cachedData = Array.isArray(teamsCache?.data)
        ? (teamsCache.data as Team[])
        : null;
      const hasFreshCache =
        !force &&
        cachedData &&
        teamsCache?.fetchedAt &&
        Date.now() - teamsCache.fetchedAt < TEAMS_STALE_MS;

      if (hasFreshCache) {
        setTeams(cachedData);
        setLoading(false);
        return;
      }

      try {
        dispatch(setResourcePending({ key: TEAMS_CACHE_KEY }));
        const res = await fetch("/api/teams");
        if (!res.ok) throw new Error("Failed to fetch teams");
        const data: Team[] = await res.json();
        setTeams(data);
        dispatch(setResourceSuccess({ key: TEAMS_CACHE_KEY, data }));
      } catch (error) {
        dispatch(
          setResourceFailed({
            key: TEAMS_CACHE_KEY,
            error:
              error instanceof Error ? error.message : "Failed to fetch teams",
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [dispatch, teamsCache?.data, teamsCache?.fetchedAt],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTeams([]);
      setActiveTeamIdState("");
      setAllTeamsMode(false);
      setLoading(false);
      return;
    }
    if (user.role === "CLIENT") {
      setTeams([]);
      setActiveTeamIdState("");
      setAllTeamsMode(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refreshTeams();
  }, [authLoading, user, refreshTeams]);

  useEffect(() => {
    if (authLoading || !user || user.role === "CLIENT") return;
    if (teams.length === 0) return;

    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;

    if (user.role === "SUPER_ADMIN") {
      const wantsAll = stored === "__all__";
      if (wantsAll) {
        setAllTeamsMode(true);
        setActiveTeamIdState("");
        return;
      }
      setAllTeamsMode(false);
      if (stored && teams.some((t) => t.id === stored)) {
        setActiveTeamIdState(stored);
        return;
      }
      setActiveTeamIdState(teams[0].id);
      return;
    }

    const allowed = new Set(user.teamIds ?? []);
    if (user.teamId) allowed.add(user.teamId);
    const firstAllowed =
      teams.find((t) => allowed.has(t.id)) ?? teams[0] ?? null;
    if (stored && allowed.has(stored) && teams.some((t) => t.id === stored)) {
      setActiveTeamIdState(stored);
      return;
    }
    setActiveTeamIdState(firstAllowed?.id ?? "");
  }, [authLoading, user, teams]);

  useEffect(() => {
    if (authLoading || !user || user.role === "CLIENT") return;

    const unsubscribe = onRealtimeChange((detail) => {
      if (detail.table !== "Team") return;
      void refreshTeams({ force: true });
    });

    return unsubscribe;
  }, [authLoading, user, refreshTeams]);

  const setActiveTeamId = useCallback((id: string) => {
    setAllTeamsMode(false);
    setActiveTeamIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
  }, []);

  const setAllTeamsModeWrapped = useCallback(
    (all: boolean) => {
      setAllTeamsMode(all);
      if (all) {
        setActiveTeamIdState("");
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, "__all__");
        }
      } else if (teams[0]) {
        setActiveTeamId(teams[0].id);
      }
    },
    [teams, setActiveTeamId],
  );

  const value = useMemo(
    () => ({
      teams,
      activeTeamId,
      setActiveTeamId,
      loading,
      refreshTeams,
      isAllTeams: user?.role === "SUPER_ADMIN" && allTeamsMode,
      setAllTeamsMode: setAllTeamsModeWrapped,
    }),
    [
      teams,
      activeTeamId,
      setActiveTeamId,
      loading,
      refreshTeams,
      user?.role,
      allTeamsMode,
      setAllTeamsModeWrapped,
    ],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error("useTeam must be used within TeamProvider");
  }
  return ctx;
}
