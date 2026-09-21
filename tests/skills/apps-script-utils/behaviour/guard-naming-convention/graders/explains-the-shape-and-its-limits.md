---
type: llm
weight: 3
---
The response explains the isX/nonX/requireX convention and that requireX throws a typed exception rather than a generic Error, so a caller can catch a specific class. It also tells the user to check the bundled API reference for whether that particular variant exists, rather than assuming every isX has a matching requireX. A response that promises the full trio always exists fails.
