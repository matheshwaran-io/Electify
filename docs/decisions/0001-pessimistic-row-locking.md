# ADR 0001: Pessimistic Row Locking for Elective Allocation

## Status
Accepted

## Context
During course registration windows, thousands of eligible students attempt to register for capped elective subjects within the first few seconds of opening. Naive multi-step checks (`SELECT available_seats > 0` followed by `UPDATE electives SET available_seats = available_seats - 1`) are vulnerable to race conditions under concurrent load, leading to oversubscribed course capacities, negative seat counters, and manual dispute resolution.

## Decision
We enforce concurrency safety at the PostgreSQL database level using **pessimistic row locking** (`SELECT ... FOR UPDATE`) within ACID transactions:
1. When a student submits course choices, candidate elective rows are locked in primary key order to eliminate deadlocks.
2. The decrement statement enforces `available_seats > 0` and atomically flips `is_full = true` when the counter hits zero.
3. If any chosen elective has zero available seats, a `SeatTakenError` is thrown, cleanly rolling back all operations in the transaction with zero orphaned rows.

## Consequences
### Positive
* **Zero Overbooking**: Impossible to allocate more seats than the maximum capacity.
* **Deterministic Allocation**: First millisecond transaction to acquire the row lock receives the seat.
* **No Waitlist Bloat**: Clean, immediate feedback to students if a seat was taken.

### Trade-offs
* Requires a database engine with robust row-locking primitives (PostgreSQL).
* Transactions must remain fast and concise to avoid prolonged connection holding.
