---
type: llm
weight: 3
---
The response says to call `SpreadsheetApp.flush()` in the server function before it returns, so the pending writes are applied before the success handler reports completion. A response that only suggests a delay, a polling loop, or a different toast fails.
