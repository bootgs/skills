import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "bootgs-validation",
  cases: [
    {
      name: "validation-error-shape",
      description: "A failed constraint throws a bare Error, not an HttpException — the trap that turns a 400 into a 500.",
      tags: ["recall", "bootgs"],
      prompt: [
        "I put `@Min(1)` on a bootgs controller method parameter. It does reject bad input, but the client",
        "gets a 500 with an unhelpful message instead of a 400 describing what was wrong. Why, and how do",
        "I get a proper error response?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-validation", arm: "with-only" },
        {
          name: "explains-the-error-type",
          type: "llm",
          weight: 3,
          criteria: [
            "The response explains that a failed validation constraint throws a bare `Error`, not an",
            "`HttpException`, which is why it surfaces as a 500 rather than a 400. It proposes a concrete",
            "way to map it — catching and rethrowing as an HttpException, or handling it in a @ControllerAdvice",
            "style handler. A response that claims bootgs already returns a 400, or that only suggests changing",
            "the decorator, fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-client",
      description: "A request that never reaches the handler is a transport/prefix problem, not a validation one.",
      tags: ["precision", "bootgs"],
      prompt: [
        "My bootgs sidebar calls the backend and every single request comes back as a route miss — the",
        "handler never runs at all. I'm calling `/widgets` from `google.script.run`. What am I doing wrong?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "bootgs-client", arm: "with-only" },
        {
          name: "validation-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "bootgs-validation",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response identifies the missing `apiPrefix` (default `/api`) as the cause — the client must",
            "call `/api/widgets` — and/or explains how the event object must be shaped for the router.",
            "A response that discusses validation decorators or pipes has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
