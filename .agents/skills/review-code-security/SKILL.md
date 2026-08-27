---
name: review-code-security
description: Review the security affected by a completed code change by tracing its trust and data paths beyond the diff. Use as the Security axis of code review or after implementation to find exploitable authorization, tenant-isolation, injection, secret-handling, browser, cache, and data-exposure failures.
---

# Review Code Security

Find evidenced vulnerabilities introduced, worsened, or materially exposed by a completed change. Produce a concise read-only report for an implementing agent.

## Process

### 1. Pin the change anchor

Use the review surface supplied by the caller: base or merge-base, commits, initial local-state snapshot, final tracked changes, untracked files, and implementation-owned paths. Resolve and verify the surface before exploring. When invoked alone without a clear surface, inspect Git state and ask only when multiple plausible scopes remain.

### 2. Load security context

Identify every language, framework, runtime, authentication mechanism, persistence layer, and external integration touched by the change. Read the repository's security rules, domain context, ownership map, package interfaces, and every relevant Accepted decision.

When `/security-best-practices` and matching language or framework references are available, load them as additional guidance. The baseline in this skill remains mandatory so the review works without a host-provided security skill.

### 3. Trace beyond the diff

Treat the change as the anchor, not the boundary. Follow every affected trust and data path from attacker-controlled or cross-tenant input through parsing, authentication, authorization, application behavior, persistence, caches, logs, external calls, and returned output.

Check the relevant paths for:

- missing, fail-open, or frontend-only authentication and authorization;
- object ownership and tenant or Organization isolation on every list, read, create, update, and delete operation;
- client-supplied user, owner, tenant, Organization, role, or resource identifiers used as proof of access;
- database queries, cache keys, background work, and delivery paths missing server-derived ownership predicates;
- injection into SQL, commands, templates, HTML, URLs, redirects, headers, logs, or model and provider instructions;
- XSS, CSRF, SSRF, unsafe CORS, cookie, OAuth, upload, webhook, and open-redirect behavior;
- exposed secrets, credentials, tokens, sensitive errors, or cross-user cached and logged data;
- unsafe defaults, bypass flags, missing validation, missing idempotency, or trust in external and model-generated content;
- tests that prove allowed behavior without proving denied behavior.

For tenant-owned data, trace the authenticated scope to the final repository predicate and cache key. A resource ID, hidden UI, or successful authentication never proves authorization. Expect negative coverage for another owner in the same tenant, the same user in another tenant, and another user in another tenant whenever those states are possible.

Keep pre-existing findings only when the change relies on the vulnerable path, expands its reach, or would make the new behavior unsafe. Exclude unrelated hardening opportunities.

### 4. Grade findings

- **Critical** — credible exploitation can broadly compromise accounts, tenants, secrets, code execution, or destructive data integrity.
- **High** — credible exploitation crosses an authorization or trust boundary, exposes or mutates protected data, or creates a major injection or credential failure.
- **Medium** — a real weakness with constrained impact, meaningful preconditions, or a defense-in-depth gap that materially affects the changed behavior.
- **Low** — suppress it. Low-priority hardening does not enter the implementation gate.

Treat uncertainty as a verification requirement, not as evidence. Suppress a finding when the attacker's control, vulnerable sink, missing control, or impact cannot be demonstrated from the reviewed path.

### 5. Report

Return at most five findings ordered by severity. For each include:

- severity and whether the issue is `Introduced or worsened` or `Exposed`;
- tight file and line references;
- the attacker-controlled entry, complete exploit path, and missing control;
- affected actor, tenant, data, or capability;
- concrete impact;
- the smallest safe fix;
- the negative test that should prove the fix;
- false-positive conditions or runtime evidence still required.

Report `Security pass` when nothing reaches Medium and add one sentence naming the trust and data paths actually checked plus any material paths outside the review surface. Stay under 500 words. Do not write a report file, expose secrets, modify code, or perform exploitation.
