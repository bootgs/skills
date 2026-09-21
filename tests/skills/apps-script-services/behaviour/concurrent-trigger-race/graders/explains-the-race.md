---
type: llm
weight: 3
---
The response identifies a lost-update race between overlapping executions and prescribes a LockService lock with an explicit timeout around the read-modify-write. A response that only suggests retrying, sleeping, or batching reads without a lock fails.
