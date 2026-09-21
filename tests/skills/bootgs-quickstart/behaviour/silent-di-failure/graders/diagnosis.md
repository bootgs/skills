---
type: llm
weight: 3
---
The response identifies `useDefineForClassFields` left at its modern default of `true` as the cause, and says it must be set to `false`. It explains the mechanism at least in outline: class fields are defined after the constructor body runs and overwrite what decorator-based DI already injected. A response that only suggests generic debugging, blames the DI registration, or recommends `experimentalDecorators`/`emitDecoratorMetadata` alone without naming `useDefineForClassFields` fails.
