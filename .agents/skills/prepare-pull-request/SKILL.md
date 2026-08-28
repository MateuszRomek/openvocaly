---
name: prepare-pull-request
description: Prepare, open, or update a GitHub pull request for review. Use when the user asks to prepare, publish, create, open, or make a pull request ready for review.
---

# Prepare Pull Request

Treat the pull request as a **review handoff**: a reviewer can understand the user-facing change, inspect its implementation, reproduce its validation, and trace it to its source ticket without asking for missing context.

## 1. Establish the handoff

1. Proceed only after the user explicitly asks to prepare, open, publish, or update a pull request. That request authorizes the Git delivery needed for the pull request, but not merging it.
2. Inspect the branch, complete diff, commits, and validation results. Derive every statement in the pull request body from those facts.
3. Identify the ticket being delivered from the user's request, branch context, commits, or tracker. If the ticket is ambiguous, fetch the plausible ticket before writing the body; ask the user only when the ambiguity remains material.

Complete this step when the change, its validation, and its ticket relationship are known well enough to write a factual review handoff.

## 2. Write the pull request body

Use exactly these sections, in this order:

```md
## Business change

<Briefly state what changes for the user, customer, or product and why it matters.>

## Technical changes

<Briefly state the main implementation changes.>

## How to test

1. <Executable verification step.>
2. <Executable verification step and expected result.>

## References

Closes #<issue-number>
```

- Keep the business and technical sections concise and specific to the delivered diff; omit neither section.
- Make **How to test** a short ordered list whenever the steps have a meaningful order. Use bullets only when the checks are independent. Include the relevant command, route, or user action and the expected result where it removes ambiguity.
- For a GitHub issue in the same repository, put `Closes #<issue-number>` in **References** exactly. This is the closing keyword that makes GitHub close the issue after the pull request is merged into its target branch; a bare `#<issue-number>` is not enough.
- For a ticket outside GitHub or in another repository, include its canonical reference in **References**. Do not claim it will close automatically.
- If no ticket applies, retain **References** and write `No ticket.` Do not invent an issue reference.

Complete this step when all four sections are present, factual, and the reference either has a valid closing keyword or explicitly states that no ticket applies.

## 3. Publish for review

1. Create a new pull request as a non-draft by default. Use `--draft` only when the user directly requests a draft pull request.
2. If an existing pull request on the branch is a draft and the user did not directly request it remain a draft, update its body and mark it ready for review.
3. Set the requested base branch; otherwise use the repository's normal default branch. Preserve the branch and complete diff unless the user directs a narrower scope.
4. After publishing, read the pull request and verify its target branch, body, URL, and review state. The normal completion state is open and non-draft (`isDraft: false`).

Complete this step only when GitHub shows the pull request with the required body and state, and report its URL, state, test instructions, and linked ticket.
