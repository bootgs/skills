---
type: llm
weight: 2
---
The response identifies the missing `apiPrefix` (default `/api`) as the cause — the client must call `/api/widgets` — and/or explains how the event object must be shaped for the router. A response that discusses validation decorators or pipes has answered a different question and fails.
