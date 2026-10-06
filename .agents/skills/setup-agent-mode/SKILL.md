---
name: setup-agent-mode
description: "Configure project or local Agent mode delegation choices: whether delegation is enabled, task and concurrency limits, nesting depth, and each role's exact worker roster, model, and reasoning effort. Use for /setup-agent-mode, configure agent mode, or changing its execution profile."
---

# Setup Agent mode

Install the shared Agent mode files in the current repository, then write `.agents/agent-mode/models.<host>.yaml` for the current coding-agent host by default. This project profile is intended to be committed and pushed. Write `.agents/agent-mode/models.<host>.local.yaml` only when the user requests a local override. The selected profile is the only persistent source of delegation limits, worker counts, models, reasoning efforts, and inheritance choices. [`assets/agent-mode/ROUTING.md`](assets/agent-mode/ROUTING.md) defines only the stable role names and their work semantics; it contains no execution defaults.

## Steps

### 1. Install the shared Agent mode files

Read [`assets/agent-mode/HOST-COMPATIBILITY.md`](assets/agent-mode/HOST-COMPATIBILITY.md). Copy the contents of `assets/agent-mode` from this skill directory to `.agents/agent-mode` in the current repository. Create the destination when it does not exist. Refresh the shared reference and agent definitions on every run, but preserve every existing `models.*.yaml` profile, including local overrides.

Ensure that the repository ignores `.agents/agent-mode/models.*.local.yaml`. Keep `.agents/agent-mode/models.<host>.yaml` trackable by git. If an ignore rule covers it, narrow that rule or add a profile-specific exception. Do not change unrelated ignore rules.

Complete this step when `.agents/agent-mode/HOST-COMPATIBILITY.md`, `.agents/agent-mode/ROUTING.md`, and both files under `.agents/agent-mode/agents` match the packaged assets.

### 2. Detect the host and available models

Resolve the host through the reference above. If the runtime does not identify itself, ask the user to select the host before writing a host-specific file. Enumerate models and reasoning efforts the host can actually assign to a subagent. Prefer the host's live model catalog or delegation-tool schema over documentation or memory. If model detection is unavailable, the only eligible worker assignment to propose is `inherit-parent`, and the user must still confirm it. Never write an identifier that the current host has not confirmed.

Record which controls the host exposes. These may include model, reasoning effort, concurrency, and a per-agent token budget. Do not promise a control the host cannot enforce. Account count is not a routing field unless the host exposes account selection directly.

### 3. Learn the user's routing goal

Before proposing assignments, establish the choices that materially change the profile. Use one compact structured question when the host supports it. Otherwise ask concise questions in chat. Do not ask for information the user already supplied.

Cover these decisions:

- what to optimize for, such as strongest results, balanced quality and cost, lowest practical cost, lowest latency, or a custom split by role;
- the token or spend budget and its unit, such as per top-level run, per delegated worker, or per day, when the user has a real limit;
- whether every host-confirmed model and reasoning effort is eligible, or the profile must use a restricted set;
- whether delegation is enabled at all;
- the maximum total number of subagent starts in one top-level task, including every nested workflow;
- the maximum number of concurrently active subagents in that task;
- the maximum delegation depth, where `1` allows only root-owned starts and `unlimited` leaves depth unrestricted;
- for every role in `ROUTING.md`, whether the coordinator performs the work or delegates it;
- for every delegated role, the exact ordered worker roster and each worker's model, reasoning effort, and host-supported budget controls;
- any roster entries that should deliberately inherit the parent because the user wants them to follow the parent selection.

If the user does not know what to choose, recommend a concrete profile from the live host catalog. Explain the main quality, latency, and cost tradeoff in plain language, then ask for confirmation. Do not make the user translate model names into a routing strategy.

Recommendations are proposals, not defaults. Do not write numeric limits, roster lengths, models, reasoning efforts, inheritance, or coordinator execution until the user confirms them. `inherit-parent` is valid only when the user explicitly selects it for that roster entry.

### 4. Load current state

Choose the write target from the requested scope: the project profile by default, or the local profile when explicitly requested. Load that target when it exists. When it is absent, load the active profile selected by `HOST-COMPATIBILITY.md` as the starting proposal. This lets an existing local profile seed the first project profile without changing its assignments or deleting it.

Show the write target and the active profile separately. If a local override exists while writing a project profile, explain that this checkout will continue using the local override, while checkouts without it will use the project profile.

Treat a version 2 profile as the current proposal to review, not proof that its tradeoffs still match the user's goal. Treat every earlier version as unconfigured: it may inform a proposal, but every limit and route must be reconfirmed before writing version 2. Until then, Agent mode starts no workers.

### 5. Recommend, map, and confirm

Propose explicit assignments supported by the active host. Match stronger reasoning to ambiguous, cross-cutting, algorithmic, and judgment-heavy roles. Match cheaper or faster models to narrow exploration and mechanical checks. Keep the recommendation inside the confirmed model set and budget. If the requested budget cannot support the requested quality or roster sizes, say so and offer the smallest useful adjustment.

Show the write scope and path, delegation mode, every delegation limit, and every role from `ROUTING.md`. For coordinator routes, show `coordinator`. For worker routes, show the exact roster length and every model/reasoning assignment. Explain non-obvious choices and mark stale identifiers. Ask the user to confirm or revise the complete profile before writing. Do not infer a special roster size, model family, or reasoning level from a role name.

### 6. Validate

The file's top-level `host` must equal the resolved host slug. Every explicit model and reasoning effort must be supported by the current host. An explicitly selected `inherit-parent` entry passes structural validation. Reject unavailable combinations before writing. From the repository root, run `python3 .agents/skills/setup-agent-mode/scripts/validate-profile.py <profile-path> .agents/agent-mode/ROUTING.md`. Then run `python3 .agents/skills/setup-agent-mode/scripts/audit-routing.py`. Structural validation checks the version 2 contract; live host validation remains the authority for model identifiers and reasoning efforts.

### 7. Write the rule

Write the confirmed profile to the selected target so reruns stay idempotent. Default to `.agents/agent-mode/models.<host>.yaml`; use `.agents/agent-mode/models.<host>.local.yaml` only for an explicitly requested local override. Preserve the other profile. Use this shape:

```yaml
version: 2
host: <resolved-host-slug>
intent:
  optimization: <confirmed-routing-goal>
  budget: <confirmed-limit-with-unit-or-none>
delegation:
  mode: enabled
  max-workers-per-task: <confirmed-positive-integer-or-unlimited>
  max-concurrent-workers: <confirmed-positive-integer-or-host-limit>
  max-delegation-depth: <confirmed-positive-integer-or-unlimited>
roles:
  feature:
    execution: coordinator
  how-explorer:
    execution: workers
    workers:
      - model: <confirmed-model-id>
        reasoning: <confirmed-reasoning-effort>
  arena-runners:
    execution: workers
    workers:
      - model: <confirmed-model-id>
        reasoning: <confirmed-reasoning-effort>
```

The angle-bracketed values describe the schema. Replace them with user-confirmed, host-validated values. Quote intent strings when YAML could interpret them as another type. Include every role listed in `ROUTING.md` when delegation is enabled. A `coordinator` route has no `workers`. A `workers` route has a non-empty roster, and that list is the complete configured capacity for one invocation of the role. To disable all delegation, keep `intent`, write only `mode: disabled` inside `delegation`, and omit `roles` and all limits. Do not maintain another role list here.

### 8. Confirm

Show the host, delegation mode, optimization goal, budget or cost posture, total task worker limit, concurrency limit, delegation depth, file path, coordinator roles, explicit worker rosters, intentionally inherited entries, and any unavailable combinations rejected during setup. Report which file this checkout will select and whether a local override masks the project profile. Re-running this skill updates only the selected scope for the current host. A project profile is ready for the user's commit and push; setup itself does not stage, commit, or push it.

### 9. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, invoke `/create-verification-skill` from its installed location. On no, move on without pushing.
