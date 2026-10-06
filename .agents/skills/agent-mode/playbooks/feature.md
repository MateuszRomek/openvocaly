### Feature

**You own the design. Plan, review, verify.** Route implementation through the configured `feature` role and stay in the lead.

1. `how` over the affected subsystem.
2. `architect` for parallel design exploration. Skipping stays as `architect skipped: <reason>`; do not fold the design decision silently into implementation.
3. Write the throughput checkpoint as four todo items. A dimension that genuinely does not apply (single file, no fan-out) keeps its item with `n/a: <reason>` rather than being dropped:
   - **Blocking first steps.** Gates run before fan-out.
   - **Independent workstreams.** Disjoint files, services, or layers parallelize. Shared writes serialize.
   - **Shared mutable state.** Default to splitting the target (the **separate-before-serializing-shared-state** principle skill). Serialize only for real invariants.
   - **Smallest safe decomposition.** Name the smallest independently verifiable semantic units; do not translate them into a worker count.
4. Turn implementation slices into semantic work units and dispatch them as `feature` through [`HOST-COMPATIBILITY.md`](../../../agent-mode/HOST-COMPATIBILITY.md). Give each unit file paths, the named data shape and organizing structure from **principle-model-the-domain**, and success criteria. The profile decides whether the coordinator or workers execute them. Review every returned diff. When implementation admits genuinely competing shapes, use **arena**; its own configured routes control the comparison. Comments per **Comments**. For upstream-derived files, re-ground against the source. Port shared-primitive improvements to every consumer and verify each.
5. Verify on the matching surface. "Inconclusive" or wrong-surface is not a pass; flag it.
6. Build and verify small ordered units. Preserve that order in commits only when the user explicitly asks for them.
   Use the **sequence-verifiable-units** principle skill, verifying each small unit before the next.
7. If the design is contested, `interrogate` before implementation.
8. Finish with verified local changes. Leave publication to the user's explicit delivery request.

Code-coupled work stays one semantic unit unless it produces independently verifiable artifacts. Independent artifacts become separate units after blocking prerequisites finish. Worker count never follows from this decomposition; setup owns it. Rewrite the checkpoint at phase boundaries.

**Reply:** what you built, what you chose and why, open decisions. Tables for design alternatives.
