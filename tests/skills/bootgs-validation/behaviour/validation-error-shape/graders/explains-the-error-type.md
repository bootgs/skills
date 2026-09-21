---
type: llm
weight: 3
---
The response explains that a failed validation constraint throws a bare `Error`, not an `HttpException`, which is why it surfaces as a 500 rather than a 400. It proposes a concrete way to map it — catching and rethrowing as an HttpException, or handling it in a @ControllerAdvice style handler. A response that claims bootgs already returns a 400, or that only suggests changing the decorator, fails.
