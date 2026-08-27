---
name: implement
description: "Implement and validate a piece of work locally from a spec or set of tickets, leaving it ready for local user review by default."
disable-model-invocation: true
---

# Implement

Implement the work described by the user, specification, or tickets and leave the final result ready for local review.

## Establish the local boundary

Before editing, create a unique review snapshot in the OS temp directory with owner-only permissions. Record the current commit, branch, `git status --short`, the specification source, a binary patch of all tracked changes against `HEAD`, and a separate binary patch of the staged index. For every pre-existing untracked entry, record its repository-relative path, `lstat` kind, and mode without following symlinks; record hashes and contents for regular files and the `readlink` target for symlinks. Refuse special files that cannot be snapshotted safely. Keep snapshot contents out of logs and user-facing output. Preserve unrelated user changes without staging, stashing, or mutating Git history.

Use that snapshot later to show `/code-review` the initial and final states even when the user and this implementation changed the same file. The review surface is the implementation delta between those states, including committed, staged, unstaged, and untracked work.

Read the repository's domain context, ownership map, and every decision and package interface governing the affected paths.

## Delivery boundary

Keep implementation, validation, remediation, and review results in the current local checkout for the user's review.

Leave changes unstaged and uncommitted by default. Perform a branch, staging, commit, amend, push, pull-request, merge, release, or other publication action only when the user explicitly requests that named action in the current conversation.

## Implement and validate

Apply the repository's `Evolutionary implementation` policy in `AGENTS.md`: choose the smallest coherent design that meets the current requirement, and make a clean internal replacement when it has a clear benefit and no external-contract or persisted-data risk.

Document non-obvious contracts at their owning declaration. Add concise JSDoc to reusable or generic functions and helpers, multi-step operations, and complex types or props whose similar names have distinct meanings, lifecycles, or usage (for example, a date versus an instant). Explain the semantic purpose, relationship, invariant, side effect, failure mode, or usage constraint needed to use it correctly; let the type signature carry the syntactic shape. Do not document self-evident local implementation details.

Use `/tdd` where practical at pre-agreed seams. Run the narrowest relevant tests and typechecking regularly, then every repository-required check and the full relevant test suite at the end. Re-read the result against its specification, domain language, ownership rules, package interfaces, and Accepted decisions.

## Review and remediate

Run `/code-review` after the first complete, validated implementation. Supply:

- the starting commit and branch;
- the initial temp snapshot with tracked and staged patches plus the original state of pre-existing untracked entries that overlap the implementation surface;
- every file and untracked path changed for this implementation;
- the specification or ticket source;
- the final local Git state.

Before editing, triage the complete review:

- Batch related `required_now` findings into one coherent remediation where practical.
- Fix hard Standards violations and missing or incorrect Spec requirements.
- Explicitly adjudicate every Architecture `High`; apply the refactor when it offers a clear architectural, product, quality, testability, or maintainability gain within a coherent scope, otherwise record the concrete constraint that outweighs it.
- Treat credible Security `Critical` and `High` findings as a closed gate. When a safe fix requires destructive data work, new authority, a product decision, or material scope expansion, stop and ask the user.
- Evaluate `evaluate` findings against YAGNI, migration cost, blast radius, and expected leverage. `Low` findings never enter the loop.
- Do not implement a `scope_expansion` finding without explicit user authorization or an already-existing requirement.

After a remediation batch, rerun the affected tests and review only the materially affected axes:

- runtime or data design → Architecture;
- trust, authorization, cache ownership, or external I/O → Security;
- contracts, decisions, configuration, or style → Standards;
- acceptance behavior → Spec.

After the targeted review is clean, run every required final check and one final `/code-review` across all four axes. Continue until:

- Standards has no unresolved hard violation;
- Spec has no missing or incorrect requirement;
- every Architecture `High` is fixed or has a concrete recorded disposition;
- Security has no unresolved credible `Critical` or `High` finding;
- the final validation passes.

When the same unresolved finding requires user authority or a product decision, report the blocker instead of cycling. If continuation requires the snapshot, state that it remains temporarily retained; otherwise remove it before yielding.

## Handoff

Remove the exact temporary snapshot on successful handoff, cancellation, or failed/abandoned execution. Never broaden cleanup beyond the snapshot directory created by this run.

Report the implemented scope, validation results, review results and dispositions, any remaining Medium follow-up worth retaining, and the exact local Git state. State that changes remain local unless the user explicitly requested delivery actions.
