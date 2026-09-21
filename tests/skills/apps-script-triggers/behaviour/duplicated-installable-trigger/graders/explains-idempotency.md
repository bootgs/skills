---
type: llm
weight: 3
---
The response identifies that creating the trigger is not idempotent — running the setup code again adds a second trigger for the same handler — and shows checking existing triggers by handler function name before creating, or deleting first. A response that blames the handler logic fails.
