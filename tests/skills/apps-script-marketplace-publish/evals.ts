import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "apps-script-marketplace-publish",
  cases: [
    {
      name: "fetches-rather-than-recites",
      description: "The review checklist is fetched live; a recited one goes stale exactly when it matters.",
      tags: ["recall", "apps-script"],
      prompt: [
        "Give me the Google Workspace Marketplace app review checklist for a Workspace add-on so I can audit",
        "my add-on against it before submitting.",
      ].join(" "),
      allowedTools: ["Read", "Glob", "Grep", "Skill", "Bash"],
      graders: [
        {
          name: "skill-fired",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-marketplace-publish",
          arm: "with-only",
        },
        {
          name: "does-not-recite-from-memory",
          type: "llm",
          weight: 3,
          criteria: [
            "The response either runs the bundled fetch script against Google's live docs, or states plainly that",
            "the checklist must be pulled from the live page rather than recited, and names how to do so.",
            "A response that simply lists a checklist from memory as if it were current — with no fetch and no",
            "caveat about the page changing — fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-clasp-workflow",
      description: "Cutting a versioned release is the clasp workflow's job, not the review process.",
      tags: ["precision", "apps-script"],
      prompt: [
        "How do I manage separate dev, staging and production script projects for one Apps Script codebase",
        "so I can test a change before it reaches anyone?",
      ].join(" "),
      graders: [
        {
          name: "neighbour-fired",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-clasp-workflow",
          arm: "with-only",
        },
        {
          name: "publish-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-marketplace-publish",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response describes the one-.clasp.json-per-environment pattern and swapping the config before",
            "pushing. A response about Marketplace review, OAuth consent screens, or store listings has answered",
            "a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
