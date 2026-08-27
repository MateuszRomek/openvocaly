---
name: merge-when-ci-passes
description: Monitor a GitHub pull request locally until every CI check for its current head is green, then squash-merge it into its target branch and update the local base branch. Use when the user asks to watch CI and merge the pull request once checks pass.
---

# Merge When CI Passes

Treat CI as a **green gate**: observe the pull request without changing its code, merge only the exact tested head, then synchronize the local target branch.

## 1. Resolve the pull request

1. Use the pull request number or URL supplied by the user. Otherwise resolve the pull request for the current branch with `gh pr view`.
2. Read at least `url`, `state`, `isDraft`, `baseRefName`, and `headRefOid`.
3. Require an open, non-draft pull request. Record its target branch and head SHA.

Complete this step when one eligible pull request and its exact head SHA are known.

## 2. Hold the green gate

Keep the monitoring loop inside the current task. Poll `gh pr checks <pr> --json bucket,name,state,workflow` locally at a sensible interval and keep the user informed when the status materially changes.

Do not create or schedule an automation, heartbeat, cron job, reminder, recurring task, separate task or thread, or any other background handoff. Continue the current task until the gate is green, the user cancels, or an external blocker makes further polling impossible.

The gate is green only when:

- at least one check is reported;
- every check is terminal;
- every bucket is `pass` or `skipping`.

Treat `pending`, `fail`, and `cancel` as a closed gate. Report failed checks, then continue monitoring for a rerun or new commit. Make no code changes unless the user separately asks for a fix. Stop early only when the user cancels or an external blocker makes further monitoring impossible.

Complete this step when all checks for the pull request's current head satisfy the green gate.

## 3. Squash-merge the tested head

1. Re-read the pull request and its checks immediately before merging.
2. Restart the green gate if `headRefOid` changed.
3. Require the pull request to remain open, non-draft, and mergeable under normal repository protections.
4. Run `gh pr merge <pr> --squash --match-head-commit <head-sha>`. Use neither admin bypass nor branch deletion unless the user explicitly requests it.
5. Verify that GitHub reports the pull request as merged and capture the merge commit.

Complete this step only when GitHub confirms that the tested head was squash-merged into the recorded target branch.

## 4. Synchronize the local target branch

Perform this step by default. Skip it when the user asks to leave the local checkout unchanged or postpone synchronization.

1. Inspect the worktree before switching branches. Preserve local changes; if they make switching unsafe, report the synchronization blocker instead of stashing or discarding them.
2. Switch to the pull request's target branch, normally `main` or `master`.
3. Pull its upstream with fast-forward only: `git pull --ff-only`.
4. Verify that the local branch matches its upstream.

Complete this step when the target branch is checked out and current, the user opted out, or a preserved-worktree blocker has been reported.

## Report

Return the pull request URL, green-check summary, merge commit, and local synchronization result.
