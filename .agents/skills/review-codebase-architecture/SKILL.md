---
name: review-codebase-architecture
description: Review the architecture affected by a completed code change by starting from its diff or local worktree and expanding through callers, consumers, tests, contracts, decisions, persistence, and adjacent modules. Use as the Architecture axis of code review or when deciding whether implemented work needs another refactor pass.
---

# Review Codebase Architecture

Find architecture problems and high-leverage deepening opportunities exposed by a completed change. Produce evidence for an implementing agent, not an HTML artifact or an interactive design session.

## Process

### 1. Pin the change anchor

Use the review surface supplied by the caller: base or merge-base, commits, local tracked changes, untracked files, and the paths the implementation claims to own. Resolve and verify the supplied commands before exploring. When invoked alone without a clear surface, inspect Git state and ask only when multiple plausible scopes remain.

### 2. Load the design context

Run `/codebase-design` for the architecture vocabulary (**module**, **interface**, **depth**, **seam**, **adapter**, **leverage**, **locality**) and its principles: the deletion test, "the interface is the test surface", and "one adapter = hypothetical seam, two = real". Use those terms exactly in every finding.

Read `CONTEXT.md`, the ownership map, package interfaces, and every relevant Accepted decision before judging the design. Repository language and decisions override generic architecture preferences.

### 3. Explore beyond the diff

Treat the change as the exploration anchor, not the boundary. Start at the changed files and hunks, then follow callers, callees, consumers, tests, configuration, persistence, public contracts, and neighboring modules until the affected capability is understood end to end. Inspect the surrounding repository as aggressively as needed to detect architectural friction that the implementation agent missed.

Explore organically and note where you experience friction:

- understanding one concept requires bouncing between many small modules;
- a module is **shallow** because its interface nearly matches its implementation;
- pure functions were extracted for testability while bugs remain in how callers coordinate them, leaving no **locality**;
- policy, invariants, error mapping, ordering, or persistence knowledge are duplicated across callers;
- one logical change requires scattered edits or coordinated knowledge;
- tightly coupled modules leak through their seams;
- callers or tests must understand implementation details that one deeper module could absorb;
- application policy leaked into a Workspace Package, or app-agnostic behavior was copied across owners;
- transitional paths, obsolete exports, compatibility code, or speculative seams remain without an active consumer.

Apply the **deletion test** to every suspected shallow module: if deleting it merely moves complexity into callers, it is earning depth; if complexity disappears, it is a pass-through. Inspect beyond the first plausible finding, compare the current design with the smallest coherent deepening, and verify that the direction improves locality, leverage, or testing without creating speculative generality.

Keep findings in either category:

- **Introduced or worsened** — the change creates duplication, a shallow module, leakage, scattered policy, a weaker test surface, or a misplaced seam.
- **Exposed** — pre-existing friction materially constrains the changed capability, and addressing it now offers concrete leverage or prevents the implementation from settling around the wrong shape.

Keep a candidate only when it has concrete file and call-path evidence, a clear source of friction, a coherent deepening direction, and an explainable gain for this change. Exclude unrelated cleanup, style preferences, and hypothetical abstractions even when they are attractive. Surface a conflict with an Accepted decision only when observed friction justifies reconsidering it, and name the conflict explicitly.

The exploration is complete when the affected capability has been traced far enough to judge its public interface and test surface, every surviving candidate passes the evidence and deletion tests, and unrelated opportunities have been excluded.

### 4. Grade actionable findings

- **High** — a concrete architecture problem materially weakens locality, leverage, correctness, or testability, and the change should not be accepted without explicitly deciding whether to refactor it.
- **Medium** — a credible improvement with meaningful upside whose value depends on scope, cost, YAGNI, or product constraints.
- **Low** — suppress it. Low-priority architecture commentary must not consume the implementing agent's attention.

### 5. Report

Return at most five findings, ordered by severity. For each finding include:

- severity and `Introduced or worsened` or `Exposed`;
- files and tight line references;
- concrete evidence and the affected call path;
- the problem in `/codebase-design` terms;
- why it matters for this change now;
- the smallest coherent deepening direction;
- expected testing impact;
- any Accepted decision that constrains the recommendation.

Report `Architecture pass` when nothing reaches Medium. Stay under 500 words. Do not write files, propose detailed interfaces, grill the user, or modify source code.
