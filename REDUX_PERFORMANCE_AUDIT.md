# Redux Performance And Loading Audit

## Scope
- Full source scan for `fetch(...)`, loading text patterns, and loading state flags.
- Objective: cache-first reads with Redux so UI uses local state unless stale or explicitly invalidated.

## Inventory Totals
- Fetch call sites: **149**
- Loading text matches: **447**
- Loading state flag matches: **51**

## Top Files By Fetch Count
- src\components\TicketWorkspace.tsx: 21
- src\app\settings\page.tsx: 16
- src\app\projects\[id]\page.tsx: 12
- src\app\tickets\page.tsx: 10
- src\app\clients\page.tsx: 9
- src\app\workload\page.tsx: 9
- src\app\teams\[teamId]\page.tsx: 6
- src\app\sprints\page.tsx: 6
- src\app\workflows\page.tsx: 6
- src\app\dashboard\page.tsx: 5
- src\app\sprints\[id]\page.tsx: 4
- src\contexts\AuthContext.tsx: 4
- src\components\CreateTicketModal.tsx: 4
- src\app\docs\[id]\page.tsx: 3
- src\app\monitoring\alerts\page.tsx: 3
- src\app\feedback\page.tsx: 3
- src\app\projects\page.tsx: 3
- src\app\client\dashboard\page.tsx: 3
- src\store\slices\notificationsSlice.ts: 3
- src\app\docs\page.tsx: 2
- src\app\auth\invite\page.tsx: 2
- src\components\SprintSelector.tsx: 2
- src\app\teams\page.tsx: 2
- src\app\api\monitoring\sentry-inbox\route.ts: 1
- src\app\api\monitoring\overview\route.ts: 1

## Top Endpoint Patterns
- `/api/tickets/${ticketId}`: 13
- "/api/clients": 7
- "/api/github/repos": 6
- "/api/notifications": 5
- "/api/tickets": 5
- `/api/projects/${id}`: 5
- "/api/teams": 4
- "/api/github/auth": 4
- `/api/tickets?${params}`: 3
- `/api/sprints?teamId=${teamId}`: 3
- "/api/workload/users": 3
- `/api/docs/${id}`: 3
- `/api/teams/${teamId}/members`: 2
- `/api/tickets/${ticketId}/obligations`: 2
- "/api/projects": 2
- "/api/github/pull-requests/assign": 2
- "/api/tickets/selector-ids/backfill": 2
- "/api/auth/login": 2
- "/api/settings/notifications": 2
- `/api/sprints?teamId=${activeTeamId}`: 2
- "/api/settings/smtp-diagnostic": 1
- "/api/settings/backup/import": 1
- "/api/auth/forgot-password": 1
- "/api/sentry-example-api": 1
- "/api/github/auth?forceUserToken=1": 1
- `/api/github/pull-requests?owner=${owner}&repo=${repo}`: 1
- `/api/github/branches?owner=${owner}&repo=${repo}`: 1
- "/api/settings/backups?take=20": 1
- "/api/settings/backup": 1
- "/api/settings/backup?download=1": 1
- `/api/settings/backups/${backup.id}`: 1
- `/api/github/branches?id=${id}`: 1
- "/api/github/pull-requests": 1
- "/api/github/branches": 1
- `/api/github/pull-requests?id=${id}`: 1
- `/api/teams/${teamId}/members/${member.userId}`: 1
- `/api/tickets/${ticketId}/attachments`: 1
- `/api/tickets/${ticketId}/comments`: 1
- `/api/tickets?teamId=${teamId}&backlogOnly=1`: 1
- `/api/tickets?${params.toString()}`: 1

## Loading States By File (Top)
- src\components\CreateTicketModal.tsx: 12
- src\components\TicketWorkspace.tsx: 10
- src\app\projects\[id]\page.tsx: 7
- src\app\dashboard\page.tsx: 7
- src\app\workflows\page.tsx: 6
- src\app\clients\page.tsx: 4
- src\app\tickets\page.tsx: 3
- src\app\projects\page.tsx: 2

## Redux Implementation Status
- Implemented global store, provider, typed hooks, resource cache slice, notifications slice, and resource registry.
- Migrated cache-first reads in: Dashboard, Tickets, Workload, TeamContext, Settings notification preferences, Header notifications.
- Realtime invalidation wired for notifications and teams; force-refresh paths on realtime events and post-mutation refresh points.

## Remaining Textual Loading Indicators (Needs Skeleton Replacement)
- src\app\auth\reset-password\page.tsx:348:              <p className="text-gray-300">Loading...</p>
- src\app\workflows\page.tsx:524:              {loadingWorkflows ? "Loading..." : "Refresh Workflows"}
- src\app\settings\page.tsx:100:              Loading settings...
- src\app\projects\[id]\page.tsx:437:        <p className="text-gray-600">{pageError || "Loading..."}</p>

## Remaining Work (Redux Migration Backlog)
- TicketWorkspace read-path caching for ticket detail, obligations, team members, sprints, repo branches, and PR metadata.
- Projects pages (`projects/page`, `projects/[id]/page`) read-path caching for project list/detail/tickets/clients/repos.
- Clients page read-path caching for clients list and client-project hydration.
- Sprints pages read-path caching for sprints and sprint ticket lists.
- Docs and Feedback list pages read-path caching.

## Validation
- All newly created Redux files compile.
- Edited migration files compile under workspace diagnostics.

