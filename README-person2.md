# Person 2 — Notification handling and catch-up summary

You own: **holding non-critical notifications while Focus Mode is active, letting rule-classified critical ones through, correlating held items by entity key, and returning the deduplicated summary.**
You do **not** touch the start/end/status API, `FocusSession`, or the SDK (that is Person 1).

Read `../SHARED-CONTRACT.md` first. You depend on Person 1's **Step 0** (`FocusSessionRepository`, `libs/dal/.../focus-session`). Until it is merged, code against the interface in the contract and `git pull` it before building.

---

## 1. How delivery works today (what I found, so you can verify)

- Every workflow step runs as a **Job** in `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts`.
- Right after loading the notification, `run-job` evaluates the subscriber's **schedule** (`schedule-validator.ts`). A step outside the schedule is marked `CANCELED`, gets a step-run + execution detail, and `return`s — **this is the exact pattern Focus Mode copies** (lines ~248-284). It is skipped for `TRIGGER / IN_APP / DELAY / DIGEST / HTTP_REQUEST` and for `notification.critical`.
- `notification.critical` (from the workflow's `critical` flag) already exists and is already used as "always deliver".
- Queue: jobs are enqueued by `AddJob`; a canceled/returned job lets the `finally` block queue the next step. Nothing new is queued by Focus Mode, so no new queue/worker is introduced.

## 2. Event-schema gaps (nothing is guessed)

| Needed | Exists? | Smallest compatible addition |
|---|---|---|
| "Is this event critical?" | **Partly.** Workflow `critical` flag, workflow `tags`, workflow identifier exist | Explicit rules: (1) `critical` flag, (2) identifier allow-list `FOCUS_MODE_CRITICAL_WORKFLOW_IDS`, (3) tag allow-list `FOCUS_MODE_CRITICAL_TAGS`. **Anything matching no rule is held.** No text/priority inference. |
| Correlation key ("same assignment / course") | **No.** Nothing on Job/Notification/payload identifies the real-world entity | Optional string `payload.entityKey` (≤200 chars) set by the system that triggers the event. Absent ⇒ never merged. Existing triggers without it keep working. |
| Held-notification storage | **No** | New collection `focusheldnotifications` (**ask-first per AGENTS.md — get approval in the PR**) |

Because `payload.entityKey` is new, **whoever triggers events (the campus app) must start sending it** for correlation to do anything; otherwise every held notification is its own group.

## 3. Files in this folder

| New file (copy as-is) | Purpose |
|---|---|
| `libs/dal/src/repositories/focus-held-notification/*` (4 files) | entity, schema (unique per session+notification, 30-day TTL), repository (`recordHeld`, `findForSession`) |
| `apps/worker/src/app/workflow/usecases/hold-for-focus-mode/focus-mode-classifier.ts` | pure rules: `classifyForFocusMode`, `parseFocusCriticalRules`, `extractEntityKey`, `FOCUS_HELD_STEP_TYPES` |
| `…/hold-for-focus-mode/focus-mode-classifier.spec.ts` | mocha/chai unit tests (no DB needed) |
| `…/hold-for-focus-mode/hold-for-focus-mode.usecase.ts` | orchestrates: gate → active session? → classify → record → cancel job |
| `apps/api/src/app/focus-summary/**` | `GET /inbox/focus-mode/summary`, grouping function + spec, DTOs, module |

## 4. Edits to EXISTING files

**a) `libs/dal/src/index.ts`**
```diff
 export * from './repositories/feed';
+export * from './repositories/focus-held-notification';
 export * from './repositories/human-contact';
```
(Person 1 adds a neighbouring `focus-session` line — if Git conflicts, keep **both** lines.)

**b) `libs/application-generic/src/usecases/create-execution-details/types/index.ts`** (next to `SKIPPED_STEP_OUTSIDE_OF_THE_SCHEDULE`):
```diff
   SKIPPED_STEP_OUTSIDE_OF_THE_SCHEDULE = "The step was skipped as it fell outside the subscriber's schedule",
+  SKIPPED_STEP_FOCUS_MODE_ACTIVE = 'The step was held because the subscriber is in focus mode',
```

**c) `libs/application-generic/src/usecases/create-execution-details/create-execution-details.usecase.ts`** (the detail → trace-event map, next to `SKIPPED_STEP_OUTSIDE_OF_THE_SCHEDULE`):
```diff
   [DetailEnum.SKIPPED_STEP_OUTSIDE_OF_THE_SCHEDULE]: 'step_skipped_outside_of_the_schedule',
+  [DetailEnum.SKIPPED_STEP_FOCUS_MODE_ACTIVE]: 'step_skipped_focus_mode_active',
```
> This map is typed per-`DetailEnum`; if the build complains elsewhere, grep `SKIPPED_STEP_OUTSIDE_OF_THE_SCHEDULE` and mirror it in every place it appears (only these two plus tests were found).

**d) `apps/worker/src/app/workflow/usecases/run-job/run-job.usecase.ts`** — 3 small edits.

import:
```diff
+import { HoldForFocusMode } from '../hold-for-focus-mode/hold-for-focus-mode.usecase';
```
constructor (append last parameter):
```diff
     private notificationPayloadService: NotificationPayloadService,
+    private holdForFocusMode: HoldForFocusMode
   ) {
```
hook — insert **immediately after** the schedule `if (isOutsideSubscriberSchedule && !this.shouldSkipScheduleCheck(...)) { ... return; }` block (just before `await this.storageHelperService.getAttachments(...)`):
```ts
      if (
        await this.holdForFocusMode.execute({
          job,
          notificationCritical: notification.critical,
          workflowTags: workflow?.tags,
        })
      ) {
        await this.conditionallyUpdateDeliveryLifecycle(job, WorkflowRunStatusEnum.PROCESSING, workflow, notification);

        return;
      }
```
(Check `PartialNotificationEntity` in `add-job.command.ts` includes `critical`; it is already read at `notification.critical` in this file.)

**e) `apps/worker/src/app/workflow/workflow.module.ts`**
```diff
 const REPOSITORIES = [
+  FocusHeldNotificationRepository,
+  FocusSessionRepository,
   AgentRepository,
 ...
 const USE_CASES = [
+  HoldForFocusMode,
   RunJob,
```
(add the imports: repositories from `@novu/dal`, `HoldForFocusMode` from `./usecases/hold-for-focus-mode/hold-for-focus-mode.usecase`).

**f) `apps/api/src/app.module.ts`**
```diff
+import { FocusSummaryModule } from './app/focus-summary/focus-summary.module';
 ...
   InboxModule,
+  FocusSummaryModule,
```
(Person 1 adds `FocusModeModule` right beside it — keep both on conflict.)

**g) config (worker env):** `IS_FOCUS_MODE_ENABLED=true`, `FOCUS_MODE_CRITICAL_WORKFLOW_IDS=…`, `FOCUS_MODE_CRITICAL_TAGS=…`. Put them in the worker `.env.example` (check `apps/worker/src/.env.test` / `.env.example` exist before editing).

## 5. Behaviour (and why it is safe)

- **Off by default.** `IS_FOCUS_MODE_ENABLED` unset ⇒ `execute()` returns `false` on its first line: no query, identical behaviour (Community, Cloud, on-prem unaffected — AGENTS.md distribution note).
- Only delivery steps are held (`in_app, email, sms, push, chat`). Trigger/digest/delay/http steps run as normal.
- Held ⇒ job `CANCELED` + step-run + execution detail `SKIPPED_STEP_FOCUS_MODE_ACTIVE`, visible in the Activity feed. **Held notifications are not delivered later one-by-one; they are represented only by the summary.** (Q1)
- A workflow with 3 channel steps ⇒ 3 held jobs ⇒ **1** `FocusHeldNotification` row (unique index + `$addToSet`). A retried job never duplicates.
- Summary groups by `entityKey`; items with no key are each their own group.
- Summary is read-only/repeatable; 409 while the session is still active; 404 for unknown/other students' session ids.

## 6. Verification cases

Unit (no infrastructure): `pnpm --filter @novu/worker test` (classifier) and `pnpm --filter @novu/api test` (grouping). Cases already in the specs: critical flag / identifier / tag ⇒ critical; look-alike names and empty rules ⇒ held; env parsing; entityKey valid/invalid; same entityKey merges (counts, channels, workflows, first/last); no entityKey never merges; different keys stay apart; empty ⇒ [].

Integration (local stack, `IS_FOCUS_MODE_ENABLED=true`, Person 1's APIs merged):
1. **Flag off**: start a focus session, trigger a normal workflow ⇒ delivered normally.
2. **Focus off** (no session), flag on ⇒ delivered normally.
3. **Active + non-critical** email workflow ⇒ job `canceled`, execution detail "held because…", **no message created**, 1 held row.
4. **Active + `critical:true` workflow** ⇒ delivered; no held row.
5. **Active + identifier in `FOCUS_MODE_CRITICAL_WORKFLOW_IDS`** ⇒ delivered. Same for a tag.
6. **Workflow with email+push steps** ⇒ 2 jobs canceled, still 1 held row with `stepTypes:[email,push]`.
7. Trigger the same event twice with the same `entityKey:"course:CS101"` ⇒ summary: 1 group, `count:2`. Without `entityKey` ⇒ 2 groups.
8. Retry/redeliver the same job ⇒ still 1 row.
9. `GET /v1/inbox/focus-mode/summary` while active ⇒ 409; after `POST …/end` ⇒ 200 with groups; call twice ⇒ identical.
10. Student B asking for Student A's `sessionId` ⇒ 404. No JWT ⇒ 401.
11. Session expires naturally (no `end` call) ⇒ new notifications deliver again; summary still available (omit `sessionId`).
12. Digest/delay steps inside a workflow during focus are not held (only the channel step after them is).

## 7. Open questions for the product owner (not invented here)

- **Q1** After focus ends, are held notifications **replaced** by the summary (implemented) or also delivered individually?
- **Q2** Should the end of focus **push** the summary (email/push/in-app message) or is pull-by-API enough (implemented)? Pushing needs a trigger/scheduler — separate design.
- **Q3** Is `in_app` held too? (Implemented: yes — edit `FOCUS_HELD_STEP_TYPES` for no.)
- **Q4** Who decides "critical" long-term — workflow author flag (implemented), an allow-list (implemented), or a per-student override?
- **Q5** Retention of held rows (30 days placeholder) and cap (1000 per session placeholder, `truncated` flag reports overflow).
- **Q6** Should notifications without `entityKey` be grouped by workflow name instead of one-per-group? (Not done: that would be a guess.)
- **Q7** Which system supplies `entityKey` and what are its values?

## 8. Checklist — Person 2 (your own Git identity)

- [ ] `git config user.name` / `user.email` are **yours**
- [ ] Branch from latest `main` **after Person 1's Step 0 is merged**: `git switch -c feat/focus-mode-handling`
- [ ] Copy `files/*` into the repo root; apply edits §4 a–f
- [ ] `pnpm build` (libs changed), run unit specs, run §6 cases
- [ ] `pnpm biome check` the touched files
- [ ] `git add` exact paths only (never `git add .`); `git status` shows nothing of Person 1's (`focus-session/`, `focus-mode/`, `packages/js`)
- [ ] Commit 1: `libs/dal` + `libs/application-generic`; Commit 2: `apps/worker`; Commit 3: `apps/api` focus-summary + `app.module.ts`
- [ ] Push, open PR, get review, merge to `main`
