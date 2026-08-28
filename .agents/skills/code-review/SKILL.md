---
name: code-review
description: "Review committed or local work across four independent axes: repository standards, originating spec, architecture, and security. Adapts to branch commits, staged and unstaged changes, and untracked files; use for implementation handoff, branch or PR review, or work-in-progress review."
---

# Code Review

Review one change surface through four independent axes:

- **Standards** — conformity with documented repository standards and the smell baseline.
- **Spec** — fidelity to the originating issue or specification.
- **Architecture** — whether the change and its surrounding capability have a coherent, deep, testable shape.
- **Security** — whether the change introduces or exposes an exploitable trust, authorization, isolation, or data-handling failure.

Keep the axes independent so one kind of success cannot mask another kind of failure.

## Process

### 1. Resolve the review surface

Treat the caller's supplied base, starting commit, paths, and pre-existing dirty state as authoritative. Otherwise inspect `git status --short`, branch tracking, recent commits, and merge-bases, then choose the surface that represents the completed work:

- local tracked changes only: compare the working tree with `HEAD`;
- branch commits only: compare `HEAD` with the relevant merge-base;
- commits plus local changes: compare the final working tree with the relevant merge-base;
- user-supplied fixed point: use its merge-base with `HEAD`, then include the local overlay;
- untracked files: list and read them explicitly because ordinary `git diff` omits them.

When called by `/implement`, use its starting commit, initial tracked and staged patches, pre-existing untracked entry states, and claimed implementation paths. Compare that snapshot with the final state to isolate implementation-owned changes even when both states touch the same path. Exclude unrelated pre-existing user changes. Ask for a fixed point only when inspection leaves multiple plausible scopes.

Record the resolved refs, commit list, tracked diff commands, untracked files, and in-scope paths once. Confirm that the combined surface is non-empty before dispatching reviewers.

### 2. Identify the spec source

Look in this order:

1. A spec or ticket supplied by the caller.
2. Issue references in the in-scope commits; fetch them through `docs/agents/issue-tracker.md`.
3. A matching file under `docs/`, `specs/`, or `.scratch/`.
4. The current conversation's explicit requirements.

If no spec exists, skip the Spec axis and report `no spec available`.

### 3. Identify the standards sources

Find repository documents that govern the changed paths, including `AGENTS.md`, ownership maps, package READMEs, Accepted decisions, `CONTRIBUTING.md`, and coding standards. Read every relevant source rather than relying on its index.

Apply this smell baseline in addition to repository standards. Repository decisions override the baseline; tooling-enforced issues stay with tooling; every smell remains a judgement call:

- **Mysterious Name** — a name hides what the code does or holds. Rename it; if no honest name exists, clarify the design.
- **Duplicated Code** — the same logic shape appears more than once. Consolidate genuine shared behavior.
- **Feature Envy** — behavior reaches into another module's data more than its own. Move behavior toward the data it owns.
- **Data Clumps** — the same fields or parameters repeatedly travel together. Give the concept one type when it is real.
- **Primitive Obsession** — a primitive stands in for a domain concept that needs invariants or behavior.
- **Repeated Switches** — the same branching over one concept recurs. Concentrate the policy.
- **Shotgun Surgery** — one logical change requires scattered edits. Improve locality.
- **Divergent Change** — one module changes for unrelated reasons. Separate ownership.
- **Speculative Generality** — abstractions or seams serve no active requirement or second adapter. Remove them.
- **Message Chains** — callers navigate structure they should not know. Hide the traversal behind the owning interface.
- **Middle Man** — a module mostly delegates without concentrating complexity. Apply the deletion test.
- **Refused Bequest** — an implementation ignores most of an inherited contract. Prefer a truthful composition.

### 4. Prepare four reviewer briefs

Give every reviewer the resolved review surface, commit list, in-scope paths, untracked files, and instructions to cite tight file and line evidence.

Require a **family sweep** before reporting: when a finding touches a lifecycle, trust
transition, mutation, cache owner, public contract, or repeated caller pattern, inspect every
equivalent entry point and caller. Report every evidenced finding from that family together;
do not stop at the first example. Each report ends with `Sweep coverage` naming the checked
paths and whether further evidenced findings remain.

#### Standards

Provide the standards-source paths and the smell baseline. Ask for every documented violation and credible baseline smell, clearly separating hard rules from judgement calls. Require the exact governing rule and affected hunk. Stay under 400 words and report `Standards pass` when empty.

#### Spec

Provide the spec source. Ask for missing or partial requirements, behavior outside the requested scope, and behavior that appears implemented incorrectly. Require a quoted requirement for every finding. Stay under 400 words and report `Spec pass` when empty.

#### Architecture

Run `/review-codebase-architecture` with the complete review surface. Require the reviewer to start at the change and expand through callers, consumers, contracts, tests, persistence, and neighboring modules. Accept only its `High` and `Medium` findings or `Architecture pass`.

#### Security

Run `/review-code-security` with the complete review surface. Require the reviewer to start at the change, expand through every affected trust and data path, and return only evidenced `Critical`, `High`, and `Medium` findings or `Security pass`.

### 5. Dispatch with bounded parallelism

Run reviewers in isolated sub-agents on `gpt-5.6-luna` with `max` reasoning effort. Set both values explicitly when dispatching each reviewer; this includes Standards and Spec as well as `/review-codebase-architecture` and `/review-code-security`. If the host cannot provide that profile, use the inherited profile and disclose the unavailable configuration in the final review.

Keep at most three reviewer sub-agents active because the parent occupies the fourth slot. Start Architecture, Security, and Standards first; start Spec as soon as one slot frees. When Spec is unavailable, run the other three together.

Do not let one reviewer see another reviewer's findings. Each axis must reach its own conclusion from the raw change and its own sources.

### 6. Aggregate without flattening

Present the reports under `## Standards`, `## Spec`, `## Architecture`, and `## Security`. Lightly clean formatting without merging, reranking, or deduplicating across axes.

For every finding, preserve its axis severity and add one remediation label for the caller:

- `required_now` — documented hard rule, spec failure, or credible `Critical`/`High` security issue;
- `evaluate` — architecture/security `Medium` or smell judgement;
- `scope_expansion` — requires a new subsystem, runtime harness, integration, product decision, or work outside the supplied spec.

End with one compact summary containing finding counts and the worst result within each axis. Preserve each axis's severity or rule semantics; the caller decides remediation.

The review is complete when the combined committed and local surface has been covered, every active axis has returned a pass or evidenced findings, and no reviewer request remains unresolved.
