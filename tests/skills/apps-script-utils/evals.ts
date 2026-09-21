import type { EvalSet } from "@testkit/gen-behaviour.ts";

export const evals: EvalSet = {
  skill: "apps-script-utils",
  cases: [
    {
      name: "guard-naming-convention",
      description: "isX/nonX/requireX, and the honesty that it is a target shape rather than a guarantee.",
      tags: ["recall", "apps-script"],
      prompt: [
        "I'm using apps-script-utils in a Sheets project. I want to reject an empty sheet name at the top of",
        "a repository function and have the caller be able to catch that specific failure rather than",
        "string-matching an Error message. What should I call, and how do I know it exists?",
      ].join(" "),
      graders: [
        { name: "skill-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-utils", arm: "with-only" },
        { name: "names-the-convention", type: "regex", pattern: "require[A-Z]" },
        {
          name: "explains-the-shape-and-its-limits",
          type: "llm",
          weight: 3,
          criteria: [
            "The response explains the isX/nonX/requireX convention and that requireX throws a typed exception",
            "rather than a generic Error, so a caller can catch a specific class. It also tells the user to check",
            "the bundled API reference for whether that particular variant exists, rather than assuming every",
            "isX has a matching requireX. A response that promises the full trio always exists fails.",
          ].join(" "),
        },
      ],
    },
    {
      name: "defers-to-services",
      description: "A property-store size failure is a platform quota question, not a utility-library one.",
      tags: ["precision", "apps-script"],
      prompt: [
        "I'm stashing a JSON blob of user settings in PropertiesService and it started throwing a vague error",
        "for some users. The blob has grown over time. How should I be handling this?",
      ].join(" "),
      graders: [
        { name: "neighbour-fired", type: "tool_used", tool: "Skill", input_match: "apps-script-services", arm: "with-only" },
        {
          name: "utils-declines",
          type: "tool_used",
          tool: "Skill",
          input_match: "apps-script-utils",
          min: 0,
          max: 0,
          arm: "with-only",
        },
        {
          name: "answers-as-the-neighbour",
          type: "llm",
          weight: 2,
          criteria: [
            "The response identifies the PropertiesService per-value size limit as the cause, says to check the",
            "serialized size before writing, and points at verifying the current limit against Google's live",
            "quotas rather than trusting a number from memory. A response about guard functions or A1 notation",
            "has answered a different question and fails.",
          ].join(" "),
        },
      ],
    },
  ],
};
