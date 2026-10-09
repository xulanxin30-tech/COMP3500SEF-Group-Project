# Project record

This is the team's central record for responsibilities, provisional milestones
and working notes. See the [README](../README.md) for the implementation status,
[Contributing](../CONTRIBUTING.md) for the development process and the
[draft Code of Conduct](../CODE_OF_CONDUCT.md) for the proposed team agreement.

## Member responsibilities

The following names and roles are carried forward from the existing repository
records. They identify coordination and review responsibilities, not exclusive
permission to edit a folder. Update this table when the team agrees a change.

| Member | Role | Responsibility and current work area |
| --- | --- | --- |
| XU Lanxin | Team lead / project management | Scope, coordination, course-requirement verification and overall delivery; project records |
| Wong Ching Fung | UI/UX design | User needs, wireframes, screen design and usability review; frontend and design discussions |
| Chi Xuanyi | Frontend development | Pages and shared Python/SQLite API integration; `frontend/` |
| XIE Jiayan | Backend development | API implementation, business logic and SQLite authentication; `backend/` |
| CEN Yin Chi | Database | Data modelling, schema and planned migrations; `database/` |
| ZHANGZHIYUAN | Testing / QA | Test planning, cases and quality evidence; `tests/` |
| Aw Chun Yin | Documentation / DevOps | Documentation and repository support, including CI and Docker packaging; deployment planned |

Some responsibilities concern future work. Their presence here does not mean
that a design deliverable, deployment folder or CI workflow already exists.

## Provisional milestones

**All entries below are carried-over planning notes awaiting verification against
the official course brief.** Dates are shown as month-day only. The year, time
zone, exact deadlines, presentation duration, Logbook count and format, and
submission method have not been verified. No date here is a confirmed course
deadline.

| Stage | Provisional date or window | Carried-over target, to be confirmed |
| --- | --- | --- |
| Initiation | 09-16 to 09-30 | Scope agreement, repository setup, design alignment and Logbook #1 |
| Design checkpoint | 09-23 | Earlier notes proposed a design freeze; confirm what needs agreement at this checkpoint |
| Build | 10-01 to 10-31 | Core workflow integration and Logbook #2 / #3 |
| Review | 11-01 to 11-23 | Working demonstration, proposed 10-minute presentation and Logbook #4 |
| Feature checkpoint | 11-30 | Proposed feature freeze before finalisation |
| Finalisation | 12-01 to 12-07 | Demo video, report and final checks |
| Submission | 12-08 | Report and final Logbook submission |

The team lead coordinates verification with the course brief or teaching staff.
Record the source title or reference, relevant section, who checked it and when
in a decision entry. Update this table with confirmed information and notify the
team when a requirement changes. Academic-integrity and AI requirements also need
an authoritative course source; this document does not supply those rules.

After a design or feature checkpoint, necessary changes remain possible through
the normal PR process. Explain the reason and effects on scope, interfaces, data
and timing, and involve the affected owners in the review.

## Working records

The blocks below are templates, not records of completed work, attendance or team
agreement. Copy a block into a GitHub Issue or append an entry under **Recorded
entries** when Issues are unavailable. Progress and decisions can also live in
the related Issue or PR; link to that record instead of maintaining duplicate
versions.

Use full dates and a time zone for actual deadlines when relevant. Keep entries
brief, factual and linked to evidence. Keep sensitive conduct concerns out of
this repository's public records.

### Task template

```markdown
### TASK-<id>: <short title>

- Owner:
- Contributors / affected module owners:
- Expected result:
- Acceptance checks:
- Due date: <date, or not yet agreed>
- Next progress update: <date/time, or not yet agreed>
- Status: <planned / in progress / blocked / in review / done>
- Evidence: <Issue, PR, design, test result or document links>
```

Agree unresolved dates before committing to delivery. Mark a task done after its
acceptance checks are satisfied; repository changes also require a merged PR.

### Progress template

```markdown
### Progress: <task reference>

- Date and author:
- Work completed since the previous update, with evidence:
- Blockers and effect on delivery:
- Next step / help needed:
- Due date and next update, including any agreed changes:
```

### Decision template

```markdown
### Decision: <topic>

- Date:
- Decision and reason:
- People involved and actual confirmations:
- Source / evidence: <include the course reference and verifier when applicable>
- Affected tasks or documents:
- Follow-up owner and due date:
```

For Code of Conduct adoption, record each member's actual confirmation and date,
any outstanding concerns, and the agreed effective date before changing the
draft's status. These notes support later course reporting; they do not replace
an official Logbook or submission format.

## Recorded entries

### TASK-container-ci: Fix container access and verify backend startup

- Owner: XIE Jiayan / GeorgeXie2333
- Contributors / affected module owners: Backend (XIE Jiayan), QA (ZHANGZHIYUAN),
  DevOps (Aw Chun Yin)
- Expected result: The Docker backend accepts requests through its published
  port; CI detects backend startup and API regressions.
- Acceptance checks: Default local listening stays on loopback; Docker listening
  uses all container interfaces; API and listen-address tests pass; the image
  starts and returns the expected health JSON through its published port in CI.
- Due date: Not yet agreed
- Next progress update: PR submission and CI result
- Status: Prepared for PR review; completion requires review and merge.
- Evidence: The PR linking this entry records the two fix commits, local checks
  and GitHub Actions result.

### TASK-python-sqlite-integration: Connect React workflows to the persistent backend

- Owner: XIE Jiayan / GeorgeXie2333
- Contributors / affected module owners: Frontend (Chi Xuanyi), backend
  (XIE Jiayan), database (CEN Yin Chi), QA (ZHANGZHIYUAN), DevOps (Aw Chun Yin)
- Expected result: Login, inventory, waybill creation and status updates all use
  the Python API and one SQLite database; orders and waybills show the same shipments.
- Acceptance checks: SQLite-backed login returns the sender user id; waybill
  creation deducts stock atomically; status updates persist without deducting
  stock again; data survives restart; frontend calls the documented API routes.
- Due date: Not yet agreed
- Next progress update: PR submission and CI result
- Status: In review; completion requires review and merge.
- Evidence: 56 Python tests, 5 frontend API integration tests, lint and production
  build passed locally. A real browser created a 5-item waybill, reduced stock
  from 120 to 115 and changed the same shipment to delivered; direct SQLite checks
  confirmed the sender, status and tracking events. The PR linking this entry
  contains the complete validation commands and CI results.
