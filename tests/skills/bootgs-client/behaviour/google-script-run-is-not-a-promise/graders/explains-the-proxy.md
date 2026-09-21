---
type: llm
weight: 3
---
The response explains that `google.script.run` is not promise-based: awaiting it resolves with the proxy object rather than the server's return value, and the result only arrives through `withSuccessHandler`/`withFailureHandler`. It shows or describes wrapping the call in a Promise.
