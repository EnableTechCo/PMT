# Internal Project & Portfolio Management Tool

### Internal Ticket Tracking & Project Coordination

This is a departmental tool designed to manage project workflows, track tickets, and facilitate coordination between internal teams and project stakeholders. It provides a centralized hub for portfolio management, featuring robust role-based access control and a dynamic Kanban interface.

---

## Table of Content

- [Quick Start Guide](#-quick-start-guide)
- [Key Features](#-key-features)
- [Tech Stack](#-tech-stack)
- [Installation & Local Setup](#-installation--local-setup)
- [Database Architecture & Management](#-database-architecture--management)
- [Authentication & Role-Based Access](#-authentication--role-based-access)
- [API Documentation](#-api-documentation)
- [Comprehensive Project Structure](#-comprehensive-project-structure)
- [Deployment Strategies](#-deployment-strategies)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Troubleshooting & FAQ](#-troubleshooting--faq)

---

## Quick Start Guide

Follow these exact steps to get the tool running on your local machine.

> [!IMPORTANT]
> **Working Directory**: All commands must be executed from the **root** folder of the project.

```bash
# 1. Install dependencies
pnpm install

# 2. Setup environment (SQLite is default)
cp .env.example .env.local

# 3. Initialize your Supabase database
# Run the SQL schema and seed scripts in Supabase SQL Editor

# 4. Start the development server
pnpm run dev
```

Visit: [http://localhost:3000](http://localhost:3000)

---

## Key Features

### Team & Stakeholder Coordination

- **Dedicated Portals**: Separate dashboards for Internal Staff and Project Stakeholders.
- **Access Control**: Stakeholders only see tickets relevant to their specific projects/departments.
- **Approval Workflow**: Stakeholders can directly flag tickets for "Revisions" or mark as "Complete".

### Project & Ticket Management

- **Kanban Workflow**: 5-stage status pipeline (Backlog → In Progress → Revisions → Stakeholder Review → Complete).
- **Portfolio Overview**: High-level tracking of multiple projects across different teams.
- **Audit Logs**: Full transparency with automated tracking of all system actions.

---

## 🛠 Tech Stack

| Layer           | Technology                                     |
| --------------- | ---------------------------------------------- |
| **Framework**   | [Next.js 15](https://nextjs.org/) (App Router) |
| **Language**    | [TypeScript](https://www.typescriptlang.org/)  |
| **Styling**     | [Tailwind CSS 4](https://tailwindcss.com/)     |
| **Database**    | Supabase PostgreSQL                            |
| **Drag & Drop** | [@dnd-kit](https://dndkit.com/)                |

---

## Installation & Local Setup

### Prerequisites

- **Node.js**: v18.0.0 or higher.
- **Package Manager**: `pnpm` is required.

### 1. Environment Configuration

Create your local environment file:

```bash
cp .env.example .env.local
```

- This project requires a Supabase Postgres database. Set the connection string in `DATABASE_URL` (found in Supabase Project → Settings → Database → Connection string).
- Example: `DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require"`
- Set a unique `JWT_SECRET` for session security.
- To enable GitHub features for every signed-in user without per-user setup, set one shared token in `GITHUB_TOKEN` (or `GITHUB_ACCESS_TOKEN` / `GITHUB_PAT`).

### 2. Database Initialization

Ensure the database is initialized in Supabase using the SQL schema and seed scripts.

---

## Database Architecture & Management

### The Schema

The system organizes work into the following hierarchy:

- **Portfolio**: High-level strategic groupings.
- **Project**: Specific initiatives within a Portfolio.
- **Team**: Departments responsible for work (e.g., Dev, Sales, Marketing).
- **Ticket**: Individual tasks with statuses and assignees.

### Management Commands

| Command               | Action                                        |
| --------------------- | --------------------------------------------- |
| `pnpm run type-check` | Type-checks the app.                          |
| `pnpm run dev`        | Starts the app in development mode.           |
| Supabase SQL Editor   | Apply schema/seed SQL and run ad-hoc queries. |

---

## Authentication & Role-Based Access

Access is managed through three distinct roles:

1. **SUPER_ADMIN**:
   - Global visibility across all Portfolios, Projects, and Teams.
   - Typically reserved for Department Heads or System Admins.
2. **USER (Internal Staff)**:
   - Manage tickets and project execution within assigned teams.
3. **CLIENT (Stakeholders)**:
   - External or internal partners who review and approve deliverables.
   - Limited to the Stakeholder Portal.

---

## API Documentation

### Auth

- `POST /api/auth/login`: Session creation via secure cookie.
- `GET /api/auth/me`: Current user state retrieval.

### Projects & Tickets

- `GET /api/tickets`: Role-filtered ticket list.
- `PATCH /api/tickets/[id]`: Status updates and assignment changes.
- `GET /api/projects`: List of active projects within the current scope.

---

## Comprehensive Project Structure

```text
├── src/
│   ├── app/              # Next.js App Router (Pages & API)
│   ├── components/       # UI Components (Kanban, Modals, Shared)
│   ├── contexts/         # State providers (Auth, Team, Theme)
│   ├── lib/              # Logic, DB Client, and Access Control
│   └── scripts/          # DB seeding and automation
└── package.json          # Dependency and script definitions
```

---

## Deployment Strategies

### Standard Build

1. Set `DATABASE_URL` to your production instance (PostgreSQL).
2. Run `pnpm build`.
3. Start the node server: `pnpm start`.

### Docker

A `Dockerfile` is provided for containerized deployment:

```bash
pnpm docker:build
pnpm docker:run
```

---

## Testing & Quality Assurance

- **Linting**: `pnpm run lint`
- **Type Checking**: `pnpm run type-check`
- **Unit Tests**: `pnpm run test`

---

## Troubleshooting & FAQ

### No data is showing up!

**Solution**: Ensure your Supabase schema and seed SQL were applied successfully.

---

**Internal Tooling - Managed by Engineering**
# PMT
