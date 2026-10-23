# Workspace setup simplification

October 23, 2026. Status: **implemented and verified locally; saved for review on the existing internal-readiness branch**.

This continues the [first access and setup repairs](internal-readiness-2026-10-23.md) from commit `b9859a809acc62ed7aa36d856837aaedf4113c4d`. It addresses the owner's request to simplify wording and screens before customer testing. The scope is Settings, the setup summary in Learn & Setup, and the first training lesson.

## What changes for the recruiter

Settings and Learn & Setup now use the same four basic information checks: recruiter details, locations and managers, role requirements, and job openings. Settings places the first missing item in a clear next-step card. Learn & Setup offers one button to continue in that same guide.

Progress says **“X of 4 basics have information.”** It describes information present in the workspace, not human review, successful saving, security approval, or launch readiness. When all four checks have information, the main action is **Review job openings**.

| Action | Destination |
| --- | --- |
| Add recruiter details | The first missing field in the existing recruiter/company form; any hiding search is cleared |
| Locations and managers | The actual facility editor section |
| Role requirements | The existing editable role requirements settings |
| Job openings | The actual positions/requisitions section |
| Pay rates | The actual rate rules section |

These setup links bypass the former “moved” intermediary pages. Existing warnings still open the exact affected opening and field. A generic setup route cannot override an active exact-record correction or replay an old route when that correction target is cleared.

Optional settings are separated from the four basics. Follow-up timing, additional contacts, pay rates, message templates, form choices, and intake rules do not inflate the required progress count. Extra contact fields, links, import/export/reset tools, setup help, and backups remain available in expandable sections.

The main form uses simpler labels such as **Company name**, **Your name**, **Your email**, and **Email signature**. The industry screen uses **suggested roles** and **screening questions**. Previewing an industry still requires an explicit Apply action before changing settings.

The first training lesson directs recruiters to candidate profiles, the calendar, and job openings. It no longer teaches the duplicate queue-oriented daily flow. The queue feature itself is not removed by this change.

## Saving status

The old **Save Changes** button only displayed a toast; it did not perform or verify a save. It is replaced with **Latest saving status**, using the same reported state already used by the application header and Learn & Setup. Disabled saving, failures, loading/saving, and a connected cloud state remain distinguishable.

This is a display correction. Existing persistence and explicit editor save/review actions are preserved. The underlying autosave mechanism does not identify which edit revision a success message acknowledges, so the display does not claim that all latest edits have been saved. Connected persistence/reload and recovery still require their own internal verification.

## Data compatibility

- Navigation and setup progress do not create, delete, save, or rewrite settings or candidate records.
- Locations can have their required information before an opening exists, even when their activity status is derived as Inactive.
- Opening activity follows the existing operational status rule. Required roles use the application's exact Active status contract.
- Openings must have a unique ID and opening number, a job title, and a uniquely resolved saved location. Location resolution uses the existing canonical ID/name/alias behavior, so renaming a location does not make valid existing openings disappear from setup progress. Duplicate source location IDs remain incomplete.
- Existing industries, messages, import/export tools, reset confirmation, and editor save/review controls are retained.

## Verification

The final stable source passed these checks with fictional records and mocked services:

| Check | Result |
| --- | --- |
| Broad Jest regression with `TZ=America/New_York` | **89 suites / 1,139 tests passed**, excluding the runner-blocked source-privacy invocation |
| Focused setup model, overview, learning, and real editor navigation cases included in that run | **83 tests passed** |
| `CI=true npm run build` | **Passed; compiled successfully** |
| Equivalent source-privacy scan from a shell-produced Git file manifest | **204 tracked/new text files; zero findings** |
| `git diff --check` | **Passed** |

The focused cases cover first-missing-field focus, search clearing, direct editor routing, non-mutating navigation, exact-opening correction precedence, optional progress, industry preview without applying, reported save states, renamed locations, and duplicate or ambiguous identities.

```sh
TZ=America/New_York CI=true npm test -- --watchAll=false --runInBand --silent --testPathIgnorePatterns=src/sourcePrivacyScan.test.js
CI=true npm run build
git diff --check
```

The existing source-privacy Jest test cannot launch nested Git in this runner (`EPERM`); its identity and reserved-email-domain rules were checked separately with a shell-produced manifest, including new files. It is not counted as a passing Jest test. Existing time-zone-sensitive tests were run with their expected New York time zone. The build emitted existing dependency/deprecation and stale Browserslist notices without a compilation error. Dependencies were not changed.

These results cover source behavior and compilation. They do not establish live database policy, deployed behavior, actual persistence/reload, or a browser visual review of every screen.

## Remaining internal work

The full access/security review and security foundation remain open, as described in the first checkpoint. Further internal setup work includes a complete first-run exercise with fictional data, persistence/reload and recovery checks, and responsive visual review. The rest of the application's wording and screens still need their own pass.

The existing exact-branch Vercel deployment guard is retained. This package does not merge, deploy, change database policies, send messages, activate integrations, or begin customer testing.
