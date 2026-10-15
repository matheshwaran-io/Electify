# Repository & Folder Structure

This document outlines the organization and architectural boundaries of the Electify codebase.

```text
electify/
├── .github/                       # CI/CD workflows (GitHub Actions)
├── docs/                          # Engineering & architecture documentation
│   ├── architecture/              # High-level system design & folder structure
│   ├── development/               # Coding standards & testing workflows
│   ├── decisions/                 # Architecture Decision Records (ADRs)
│   └── qa/                        # QA regression and test reports
├── drizzle/                       # Database schema migrations & SQL rollbacks
├── public/                        # Static public assets (icons, presentation)
├── scripts/                       # Maintenance, seed, and data management scripts
│   ├── brand/                     # Brand vector asset generators
│   └── db/                        # Database migration runners
├── src/
│   ├── app/                       # Next.js 16 App Router routes & server actions
│   │   ├── actions/               # Domain-specific mutating server actions
│   │   │   ├── academic-sessions.ts
│   │   │   ├── admin.ts
│   │   │   ├── auth.ts
│   │   │   ├── coordinator.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── database.ts
│   │   │   ├── monitor.ts
│   │   │   ├── register.ts
│   │   │   ├── replay.ts
│   │   │   ├── subjects.ts
│   │   │   ├── templates.ts
│   │   │   ├── tutor.ts
│   │   │   ├── user.ts
│   │   │   ├── workspace.ts
│   │   │   └── year-servers.ts
│   │   ├── api/                   # Route handlers (health, switch-section)
│   │   ├── countdown/             # Waiting hall for scheduled registration windows
│   │   ├── dashboard/             # Student registration and subject selection
│   │   ├── faculty/               # Staff and administrative workspaces
│   │   ├── login/                 # Unified student and staff authentication
│   │   ├── maintenance/           # System-wide maintenance mode view
│   │   ├── globals.css            # Tailwind CSS v4 design tokens and theme rules
│   │   └── layout.tsx             # Root HTML layout and providers
│   ├── components/                # Modular React 19 UI components
│   │   ├── auth/                  # Authentication cards, modals, password inputs
│   │   ├── layout/                # App shell, navigation, session indicator
│   │   ├── student/               # Student dashboard chrome and controls
│   │   ├── subjects/              # Subject cards, explorer, seat availability
│   │   ├── tutor/                 # Tutor onboarding, invite codes, reset queues
│   │   ├── ui/                    # Base UI design system (buttons, inputs, dialogs)
│   │   └── window/                # Registration event timeline and metrics
│   ├── hooks/                     # Custom reusable React hooks
│   │   ├── index.ts               # Hook barrel exports
│   │   └── use-server-clock.ts    # Server clock synchronization and ticker
│   ├── lib/                       # Shared utility functions and database client
│   │   ├── db/                    # Drizzle client, connection pool, schema, seed
│   │   ├── academic.ts            # University hierarchy and cohort helpers
│   │   ├── auth.ts                # JWT creation, cookie session verification
│   │   ├── brand-pdf.ts           # PDF receipt generation engine (jsPDF)
│   │   ├── cache.ts               # Safe Next.js cache and path revalidation
│   │   ├── format.ts              # Text normalization and name cleaning
│   │   ├── password-policy.ts     # Password complexity and rule enforcement
│   │   ├── registration-window.ts # Event phase calculations
│   │   ├── seat-ops.ts            # Concurrency-safe SQL seat modifications
│   │   ├── seats.ts               # Pure seat availability & status helpers
│   │   ├── student-events.ts      # Student event resolution and eligibility
│   │   ├── supabase.ts            # Supabase Realtime client
│   │   ├── utils.ts               # Tailwind class merging (cn utility)
│   │   └── workspace.ts           # Staff workspace resolution and scope
│   ├── types/                     # Centralized domain and API TypeScript contracts
│   │   ├── index.ts               # Types barrel export
│   │   ├── academic.ts            # University hierarchy contracts
│   │   ├── api.ts                 # API response & health check contracts
│   │   ├── registration.ts        # Registration results, receipts, seats
│   │   └── session.ts             # Auth session, roles, login results
│   └── proxy.ts                   # Next.js 16 Edge proxy & route guard middleware
├── tests/                         # Automated unit, integration, and e2e test suites
│   ├── e2e/                       # Playwright browser end-to-end tests
│   ├── helpers/                   # Test fixtures and isolation world helper
│   ├── password-policy.test.ts    # Unit tests for password validation
│   ├── qa-regressions.test.ts     # Unit tests for QA and phase logic
│   └── *.test.ts                  # Integration test suites (academic, registration, etc.)
├── .env.example                   # Environment configuration template
├── components.json                # shadcn/ui configuration
├── package.json                   # Project scripts and dependencies
└── tsconfig.json                  # TypeScript compiler configuration
```
