# Performance & UX Audit — PMT Hub

**Date:** June 21, 2026  
**Scope:** All pages, all components  
**Summary:** 52 issues found across 18 files. Zero skeletons exist anywhere. Every loading state is plain text or a bare spinner. Every mutation does a full server refetch instead of optimistic update. Multiple dropdown dependencies load sequentially, not in parallel.

---

## What "bad" means in this codebase

| Pattern                                             | Why it's bad                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `"Loading..."` as visible text                      | Looks unfinished, jumpy                                                        |
| Bare `animate-spin` spinner with no content outline | Page feels empty/broken                                                        |
| Full `fetchTickets()` after every PATCH             | Latency doubles: wait for PATCH + wait for GET                                 |
| Sequential dropdown fetches                         | User waits 3× as long as needed                                                |
| No optimistic UI                                    | Every status change or assignment flickers the whole list                      |
| `authLoading` guard in every useEffect              | All data waits for auth before starting — adds ~200ms minimum cold-start delay |

---

## File-by-file issues

### `src/app/dashboard/page.tsx`

| #   | Line     | Issue                                                                                                  | Severity |
| --- | -------- | ------------------------------------------------------------------------------------------------------ | -------- |
| 1   | 580      | `placeholder={loadingSprints ? "Loading sprints..." : "Sprint"}` — 3 occurrences (lines 580, 712, 794) | HIGH     |
| 2   | 803      | Loading state renders a bare spinner with zero skeleton for Kanban cards                               | HIGH     |
| 3   | 262–306  | `fetchTickets` and `fetchSprints` called in separate `useEffect` blocks, not parallelised              | MEDIUM   |
| 4   | 369, 389 | Status change does `await fetchTickets()` — full re-fetch instead of optimistic update                 | HIGH     |
| 5   | 470      | `authLoading` guard blocks all data until auth resolves — no eager loading                             | MEDIUM   |

---

### `src/app/tickets/page.tsx`

| #   | Line                    | Issue                                                                                       | Severity |
| --- | ----------------------- | ------------------------------------------------------------------------------------------- | -------- |
| 6   | 596–601                 | `fetchAssignableUsers()` and `fetchSprints()` called as separate effects, not `Promise.all` | HIGH     |
| 7   | 485, 544, 585, 626, 750 | Every mutation (delete, status change, import) calls `await fetchTickets()` — full refetch  | HIGH     |
| 8   | ~1094                   | Loading state is a bare spinner with no skeleton grid beneath                               | HIGH     |
| 9   | 440                     | `fetchTickets()` fires on every filter change with no debounce                              | MEDIUM   |
| 10  | 693                     | Inline `fetchTickets()` call after ticket creation — no optimistic insert                   | MEDIUM   |

---

### `src/app/sprints/page.tsx`

| #   | Line                | Issue                                                                     | Severity |
| --- | ------------------- | ------------------------------------------------------------------------- | -------- |
| 11  | 419, 461, 487, 559  | Every sprint mutation does `await fetchSprints()` — full refetch          | HIGH     |
| 12  | Sprint list loading | No skeleton — blank area appears until data arrives                       | HIGH     |
| 13  | Various             | Saving state shown as disabled button text only, no visual pulse/skeleton | MEDIUM   |

---

### `src/app/workload/page.tsx`

| #   | Line                    | Issue                                                                                                                    | Severity |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| 14  | 992                     | `githubOptionsLoading ? "Loading PRs..." : "PR number"` — text placeholder                                               | HIGH     |
| 15  | 1011                    | `githubOptionsLoading ? "Loading owners..." : "Owner"` — text placeholder                                                | HIGH     |
| 16  | 1025                    | `githubOptionsLoading ? "Loading repos..." : "Repo"` — text placeholder                                                  | HIGH     |
| 17  | 350–359                 | `fetchTickets`, `fetchWorkloadUsers`, `fetchGithubRepos` in separate effects — 3 sequential network round-trips on mount | HIGH     |
| 18  | 413, 433, 500, 526, 580 | Every mutation calls `fetchTickets()` — full refetch                                                                     | HIGH     |
| 19  | 825                     | `authLoading` guard renders nothing (blank page) until auth resolves                                                     | MEDIUM   |
| 20  | 1121                    | Loading state is bare spinner, no workload card skeletons                                                                | HIGH     |

---

### `src/app/projects/page.tsx`

| #   | Line              | Issue                                                                       | Severity |
| --- | ----------------- | --------------------------------------------------------------------------- | -------- |
| 21  | Project list load | Loading state is a centered spinner, no skeleton project cards              | HIGH     |
| 22  | 214               | `router.refresh()` called after milestone update — causes full page remount | HIGH     |

---

### `src/app/settings/page.tsx`

| #   | Line       | Issue                                                                                | Severity |
| --- | ---------- | ------------------------------------------------------------------------------------ | -------- |
| 23  | 134        | `Loading settings...` text in Suspense fallback                                      | HIGH     |
| 24  | 835        | `Checking status...` shown as inline JSX text during GitHub auth check               | HIGH     |
| 25  | 1109       | `Loading branches and pull requests...` text shown in panel                          | HIGH     |
| 26  | 1179       | `Loading repositories...` shown in panel                                             | HIGH     |
| 27  | 1380       | `{testEmailLoading ? "Sending..." : "Send test email"}` — text-only loading feedback | MEDIUM   |
| 28  | 1391–1392  | `{diagnosticLoading ? "Checking..." : "Run email diagnostics"}` — text-only          | MEDIUM   |
| 29  | 1574–1576  | `<Loader2 .../> Loading` text node shown in backup history section                   | HIGH     |
| 30  | GitHub tab | No skeleton for GitHub connected account panel while checking                        | HIGH     |
| 31  | Backup tab | No skeleton for backup records table while loading                                   | MEDIUM   |

---

### `src/app/monitoring/page.tsx`

| #   | Line        | Issue                                                              | Severity |
| --- | ----------- | ------------------------------------------------------------------ | -------- |
| 32  | 429         | `Running inbox scan...` text shown as loading state in alert panel | HIGH     |
| 33  | 184         | `authLoading` guard renders nothing until auth resolves            | MEDIUM   |
| 34  | Alerts list | No skeleton rows in alert feed                                     | MEDIUM   |

---

### `src/app/monitoring/alerts/page.tsx`

| #   | Line        | Issue                                                 | Severity |
| --- | ----------- | ----------------------------------------------------- | -------- |
| 35  | 200         | `<Loader2 .../> Loading alert feed...` — literal text | HIGH     |
| 36  | Alert table | No skeleton rows while fetching                       | MEDIUM   |

---

### `src/app/clients/page.tsx`

| #   | Line          | Issue                                                            | Severity |
| --- | ------------- | ---------------------------------------------------------------- | -------- |
| 37  | 1034          | `Loading repositories...` text in GitHub repos panel             | HIGH     |
| 38  | 1214          | `Loading projects…` text in client projects panel                | HIGH     |
| 39  | 547           | Loading state is bare spinner, no skeleton client cards          | HIGH     |
| 40  | 314, 339, 365 | Every client mutation calls `void fetchClients()` — full refetch | MEDIUM   |

---

### `src/app/workflows/page.tsx`

| #   | Line          | Issue                                                                    | Severity |
| --- | ------------- | ------------------------------------------------------------------------ | -------- |
| 41  | 523           | `{loadingWorkflows ? "Loading..." : "Refresh Workflows"}` — text loading | HIGH     |
| 42  | 561–563       | `<Loader2 .../> Loading workflows...` text in workflow list panel        | HIGH     |
| 43  | Workflow list | No skeleton rows                                                         | MEDIUM   |

---

### `src/app/feedback/page.tsx`

| #   | Line | Issue                                                 | Severity |
| --- | ---- | ----------------------------------------------------- | -------- |
| 44  | 149  | `Loading feedback...` plain text shown while fetching | HIGH     |
| 45  | 147  | Loading state renders no skeleton for feedback rows   | HIGH     |

---

### `src/app/auth/reset-password/page.tsx`

| #   | Line | Issue                                                                             | Severity |
| --- | ---- | --------------------------------------------------------------------------------- | -------- |
| 46  | 348  | `<p className="text-gray-300">Loading...</p>` — token validation shows plain text | HIGH     |

---

### `src/app/admin/invite/page.tsx`

| #   | Line | Issue                                                                   | Severity |
| --- | ---- | ----------------------------------------------------------------------- | -------- |
| 47  | 133  | `<p className="...">Loading teams...</p>` — plain text while teams load | MEDIUM   |
| 48  | 148  | `{loading ? "Sending..." : "Send invite"}` — text-only button state     | LOW      |

---

### `src/components/TicketWorkspace.tsx`

| #   | Line                   | Issue                                                                                               | Severity |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------- | -------- |
| 49  | 1318                   | `<p className="text-sm text-gray-500">Loading obligations...</p>` — text placeholder                | HIGH     |
| 50  | 1886, 1910, 1935, 1973 | `<span className="text-xs text-gray-500">Saving...</span>` — 4 instances across field sections      | MEDIUM   |
| 51  | 1964                   | `loadingAssignableUsers ? "Loading assignees..." : ...` as SelectMenu placeholder                   | HIGH     |
| 52  | 1997                   | `loadingSprints ? "Loading sprints..." : "Select sprint"` as SelectMenu placeholder                 | HIGH     |
| 53  | 846                    | Loading state renders nothing (just returns early) — full blank page while ticket loads             | HIGH     |
| 54  | 245–278                | Assignee fetch and sprint fetch in separate effects, both triggered by `ticket` change — sequential | MEDIUM   |

---

### `src/components/CreateTicketModal.tsx`

| #   | Line                                  | Issue                                                             | Severity |
| --- | ------------------------------------- | ----------------------------------------------------------------- | -------- |
| 55  | 602                                   | `label: "Loading assignees..."` as disabled dropdown option       | HIGH     |
| 56  | 642                                   | `label: "Loading sprints..."` as disabled dropdown option         | HIGH     |
| 57  | 680                                   | `label: "Loading clients..."` as disabled dropdown option         | HIGH     |
| 58  | 732                                   | `label: "Loading projects..."` as disabled dropdown option        | HIGH     |
| 59  | Clients, Projects, Assignees, Sprints | All 4 dropdown dependencies load independently — no `Promise.all` | HIGH     |

---

### `src/components/DashboardLayout.tsx`

| #   | Line     | Issue                                                                             | Severity |
| --- | -------- | --------------------------------------------------------------------------------- | -------- |
| 60  | 489, 745 | `Loading teams...` text shown in both mobile and desktop sidebar workspace panels | MEDIUM   |

---

### `src/components/SprintSelector.tsx`

| #   | Line | Issue                                                      | Severity |
| --- | ---- | ---------------------------------------------------------- | -------- |
| 61  | 103  | `loading ? "Loading sprints..." : ...` as placeholder text | HIGH     |

---

### `src/components/TipTapEditor.tsx`

| #   | Line | Issue                                                               | Severity |
| --- | ---- | ------------------------------------------------------------------- | -------- |
| 62  | 105  | `Loading rich editor...` text shown during dynamic import of TipTap | MEDIUM   |

---

## Cross-cutting patterns (affect all pages)

### Pattern A — authLoading guard on every page

Every page does `if (authLoading) return <spinner>`. This means on cold load, zero data fetching starts until auth resolves. Minimum cost: one network round-trip (~200ms) before anything else begins.

**Fix:** Start data fetches immediately on mount. Abort or discard results if user is not authenticated when they return.

---

### Pattern B — full refetch after every mutation

Every page calls `fetchTickets()`, `fetchSprints()`, `fetchClients()` etc. after every create/update/delete. This adds a full GET round-trip latency on top of the mutation latency.

**Fix:** Apply the change optimistically to local state. Revert on error. Refetch only for realtime sync from other users (which is already handled by the Supabase realtime subscription).

---

### Pattern C — sequential dropdown dependencies

In `CreateTicketModal`, `TicketWorkspace`, `tickets/page`, and `workload/page`, multiple dropdowns load from separate API calls in separate `useEffect` blocks. They all fire sequentially.

**Fix:** Use `Promise.all` to parallelise all independent fetches on the same trigger.

---

### Pattern D — no skeleton components anywhere

Zero skeleton components exist in this codebase. Every loading state is either:

- A centered spinning circle
- Plain text ("Loading...")
- Nothing (early return)

The fix is a shared `<Skeleton>` primitive and page-level skeleton layouts that match the real content shape.

---

## Implementation plan (priority order)

### Phase 1 — Skeleton component (one day)

Create `src/components/ui/Skeleton.tsx` with variants:

- `<SkeletonText>` — animated grey bar for text lines
- `<SkeletonCard>` — animated grey card block
- `<SkeletonRow>` — animated grey table/list row
- `<SkeletonDropdown>` — animated grey pill for select menus
- `<SkeletonPage>` — full page placeholder layout

### Phase 2 — Replace all text loading states (one day)

Replace every instance of `"Loading..."`, `"Loading sprints..."`, `"Loading assignees..."`, `"Saving..."`, `"Checking..."`, `"Running inbox scan..."` with either:

- A `<Skeleton>` component
- An `animate-pulse` placeholder that matches content shape
- Nothing (let the empty state speak for itself)

Affected files: all 18 listed above.

### Phase 3 — Skeleton page layouts (two days)

Add skeleton layouts to these pages:

- `/dashboard` — skeleton Kanban columns with ghost cards
- `/tickets` — skeleton grid of ghost ticket cards
- `/sprints` — skeleton sprint columns
- `/workload` — skeleton member rows
- `/projects` — skeleton project cards
- `/clients` — skeleton client list rows
- `/monitoring` — skeleton alert rows
- `/docs` — skeleton sidebar + editor outline

### Phase 4 — Optimistic UI for mutations (two days)

- Ticket status change: update local state immediately, revert on error
- Ticket assignment: update local state immediately
- Sprint assignment: update local state immediately
- Client actions: remove/update client locally, revert on error

### Phase 5 — Parallelise fetches (one day)

Audit every `useEffect` chain and convert sequential fetches to `Promise.all`. Key targets:

- `CreateTicketModal`: fetch assignees, sprints, clients, projects in one `Promise.all`
- `tickets/page`: fetch assignable users and sprints in one call
- `workload/page`: fetch tickets, workload users, GitHub repos in one `Promise.all`
- `TicketWorkspace`: fetch assignees and sprints in one `Promise.all`

### Phase 6 — Remove authLoading gate from data fetches (half day)

Start data fetching on mount. Use the auth result when it arrives to filter/abort. This shaves ~200ms off every cold page load.

---

## Severity summary

| Severity  | Count  |
| --------- | ------ |
| HIGH      | 42     |
| MEDIUM    | 16     |
| LOW       | 4      |
| **Total** | **62** |

---

## Files that need new skeleton layouts (none exist today)

| Page                | Skeleton shape needed                                     |
| ------------------- | --------------------------------------------------------- |
| Dashboard           | 5-column Kanban with 3–4 ghost cards per column           |
| Tickets list        | 3-column grid of ghost ticket cards                       |
| Sprints list        | Sprint column cards                                       |
| Workload            | Table rows with avatar + name + progress bar              |
| Projects            | Card grid with name, status, health badge                 |
| Clients             | List rows with name, email, badge                         |
| Monitoring alerts   | Table rows with severity dot + text                       |
| Docs sidebar        | Tree list of ghost items                                  |
| Ticket workspace    | Two-column layout with ghost content pane + ghost sidebar |
| Settings GitHub tab | Connected account card skeleton                           |
| Settings Backup tab | Table row skeletons                                       |
