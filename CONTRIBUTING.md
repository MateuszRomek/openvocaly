# Contributing to OpenVocaly

Thanks for helping improve OpenVocaly.

At this stage, we prioritize feedback and small, focused improvements over large unsolicited feature work.

## Best Ways To Contribute (No Code Required)

- report bugs with exact reproduction steps
- share onboarding/setup friction
- propose workflow improvements with real usage context
- suggest documentation clarifications or corrections

These inputs help shape direction and reduce wasted implementation effort.

## Before Opening A Pull Request

For any non-trivial change, open an issue first and align on scope before writing code.

This includes:

- new features
- architecture changes
- behavior changes that affect user workflows
- cross-cutting refactors

If a pull request does not have prior issue/discussion alignment for a non-trivial change, maintainers may close it.

## What Pull Requests Are Usually Welcome

- small, targeted bug fixes
- focused reliability or performance improvements
- docs improvements tied to real confusion points
- low-risk maintenance work with clear impact

Keep PRs small and reviewable.

## What Is Usually Not Accepted Right Now

- large unsolicited refactors
- broad feature drops without prior alignment
- sweeping style-only changes unrelated to a user-facing issue

## Reporting Bugs

When opening a bug report, include:

- expected behavior
- actual behavior
- exact reproduction steps
- environment details (OS version, app version/commit)
- logs/screenshots if available

## Proposing Features

When opening a feature request, include:

- the problem you are trying to solve
- current workaround and its drawbacks
- expected outcome
- smallest useful scope

Focus on user outcome first, implementation second.

## Development Setup

See `README.md` for current setup instructions and prerequisites.

For first-time local setup:

```bash
npm run setup:dev
```

Useful checks before opening a PR:

```bash
npm run lint
npm run typecheck
```

## Code Of Conduct

Be respectful and constructive in issues, discussions, and pull requests.
