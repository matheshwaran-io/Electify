# ADR 0002: Academic Year Server Isolation

## Status
Accepted

## Context
Universities manage ongoing academic cohorts across multiple years simultaneously (e.g. 2024, 2025, 2026, 2027). In traditional ERP systems, queries that mix cohorts require complex filtering across graduating batches, increasing query overhead and introducing the risk of accidental data leakage or cross-batch overrides.

## Decision
We organize academic administration into distinct **Year Servers** (annual workspaces):
1. Upon logging in, faculty select their active academic session (`/faculty/select-year-server`).
2. Staff queries, student rosters, elective offerings, and reports are strictly scoped to the selected academic session.
3. Class tutors can supervise sections across different cohorts without data bleeding between academic timelines.

## Consequences
### Positive
* **Clean Data Separation**: Historical academic data remains intact and isolated from active cohorts.
* **Simplified Queries**: Eliminates complex multi-year joins and minimizes indexing overhead.
* **Audit Isolation**: Logs and registration events are partitioned by academic timeline.

### Trade-offs
* Faculty members working across multiple batches must switch their active session via the workspace switcher.
