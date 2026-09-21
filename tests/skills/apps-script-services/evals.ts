import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "apps-script-services",
  cases: [
    {
      name: "concurrent-trigger-race",
      description: "A read-then-write across overlapping trigger executions needs LockService, not a retry.",
      tags: ["recall", "apps-script"],
      prompt: [
        "I keep a running counter in a cell. An onEdit handler reads it, adds one, and writes it back.",
        "Under load the count comes out low — some increments just vanish. I added a retry and it still",
        "happens. How do I fix this properly?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-services", arm: "with-only" },
        { name: "names-lockservice", type: "regex", pattern: "LockService" },
        {
          name: "explains-the-race",
          type: "llm",
          weight: 3,
          criteria: [
            "The response identifies a lost-update race between overlapping executions and prescribes a",
            "LockService lock with an explicit timeout around the read-modify-write. A response that only",
            "suggests retrying, sleeping, or batching reads without a lock fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-ui",
      description: "A dialog button that silently does nothing is the trailing-underscore trap, not a service problem.",
      tags: ["precision", "apps-script"],
      prompt: [
        "I built a modal dialog in my Sheets add-on. Clicking the Save button in it does absolutely nothing —",
        "no error in the browser console, nothing in the execution log, the server function never seems to",
        "run. The function is called `saveSettings_`. Any idea?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-ui", arm: "with-only" },
        {
          name: "services-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-services",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response identifies the trailing underscore in `saveSettings_` as the cause — a private function",
            "is unreachable from google.script.run and the call silently does nothing — and says to rename it.",
            "A response about quotas, locks, or UrlFetchApp has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
