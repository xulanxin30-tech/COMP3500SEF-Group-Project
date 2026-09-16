# Contributing

This guide describes the working process for the COMP3500SEF team, including
small documentation changes. Use English for project documents, commit messages
and PR descriptions. Keep explanations clear enough for another member to follow.

Read the [README](README.md) for the current implementation and commands, the
[project record](docs/PROJECT.md) for responsibilities and templates, and the
[draft Code of Conduct](CODE_OF_CONDUCT.md) for the proposed team agreement.

## 1. Agree on a task

Create a GitHub Issue using the task template in the project record. If Issues
are unavailable, add the task directly to that record. Keep one authoritative
task entry and link to it from the PR.

Record an owner, expected result, acceptance checks, deadline and next progress
update. Use an explicit "not yet agreed" for an unresolved date and agree it
before committing to delivery. Name anyone whose module or interface is affected.

Module owners coordinate changes and reviews. Contributors may work across
modules after discussing the change with the affected owners. For an API or
schema change, explain the expected effect on callers, data and integration in
the task and PR, and update the relevant documentation in the same PR.

## 2. Set up a local checkout

Install Git and Python 3 and confirm which shared repository the team uses. Copy
its clone URL from the repository's **Code** menu. The examples below assume
`origin` is that shared repository and you have push access.

Replace `REPLACE_WITH_TEAM_REPOSITORY_URL` with the copied URL before running:

```sh
git clone "REPLACE_WITH_TEAM_REPOSITORY_URL" COMP3500SEF-Group-Project
cd COMP3500SEF-Group-Project
git remote -v
```

Check that the displayed remote is the intended repository. If you use a personal
fork, first synchronise it with the team repository; push your branch to your
fork and select the team repository's `main` as the PR base.

Check your commit identity:

```sh
git config user.name
git config user.email
```

If either is missing or incorrect, set it for this checkout. Replace both example
values with your own name and GitHub-associated email or GitHub no-reply address:

```sh
git config user.name "Your Name"
git config user.email "your-email@example.com"
```

## 3. Start a short-lived branch

Start with `git status`. If it shows unfinished changes, finish or safely save
that work before switching branches. The following example is a README task;
choose a different branch name for each task:

```sh
git status
git switch main
git pull --ff-only origin main
git switch -c docs/update-readme
```

Use descriptive names such as `feature/order-list`, `fix/order-validation` or
`docs/update-readme`. Task branches merge directly into `main` through PRs.
If the fast-forward pull fails, inspect the divergence with a teammate before
continuing; do not discard commits or force-push to make the error disappear.

## 4. Make and check the change

Edit the source or document files directly. Keep each PR focused on one task.
Run the relevant [README checks](README.md#run-the-examples-locally) and record
the commands, results and limitations. For a documentation-only change, check
rendering, links and changed instructions; business tests are needed only if
the change affects them. The existing example tests do not establish business
coverage.

Review the diff and stage the intended files. In this example only README is
being changed; replace that path with the files for your own task:

```sh
git diff
git add -- README.md
git diff --staged
git commit -m "docs: clarify local setup"
git push -u origin docs/update-readme
```

Write a short English message describing the change. Prefixes such as `docs:`,
`feat:` and `fix:` are useful but a clear description matters most. Check that
the staged files contain no passwords, access tokens or private personal data.

## 5. Open, review and merge a PR

Open a pull request with the team repository's `main` as the base and your task
branch as the comparison. Fill in the [PR template](.github/pull_request_template.md):
linked task, change and reason, checks with actual results, documentation impact
and requested reviewers. Request review from at least one other team member;
include the relevant module owners when their work is affected.

The template becomes available automatically after it reaches the repository's
default branch. See [GitHub's PR template documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository).

Reviewers check the task's acceptance criteria, correctness, integration impact
and validation evidence. Give actionable feedback about the work. Address
comments, push follow-up commits to the same branch and request another review
when the reviewed content changes.

If `main` changes during the task, run these commands on your task branch with
a clean working tree:

```sh
git fetch origin
git merge origin/main
```

If there are conflicts, agree on the intended result with the affected owner,
resolve the markers, stage the resolved files and complete the merge with
`git commit`. Repeat checks affected by the resolution. Ask for help before
committing a resolution you cannot explain.

After updating the branch, push it with `git push` and request review of the
latest changes before merging the PR.

A member with merge permission may merge after at least one other member has
approved the latest changes, review comments are resolved, and relevant checks
pass. The author cannot supply their own required approval. Record the merged
PR and acceptance evidence in the task before marking it done. Delete the merged
remote task branch using GitHub, then update the local checkout:

```sh
git switch main
git pull --ff-only origin main
```

The review requirement is a team workflow rule. GitHub branch protection and
approval enforcement have not been verified, and this repository has no CI
workflow configured. Reviewers must check the supplied validation evidence.

## Browser workflow for small documentation edits

1. Open the file in the shared repository on `main` and select the pencil icon.
2. Edit the text and use **Preview** to check Markdown formatting and links.
3. Select **Commit changes**, enter a clear English message and choose to create
   a new branch, for example `docs/clarify-setup`.
4. Commit or propose the change and open a PR targeting the team repository's
   `main`. Complete the PR description and request another member's review.
5. For follow-up edits, select the same task branch before editing. Use the
   review and merge process above.

If repository permissions or branch protection prevent editing, use the local
branch workflow or ask the maintainer for access. See [GitHub's file-editing
guide](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)
for the editor steps.

## Keep the team informed

Use the existing group chat for quick, asynchronous coordination. Keep important
decisions and progress evidence in the linked task, PR or project record. Give
updates at the time agreed in the task; report blockers and likely delays as
soon as they become apparent, with the impact and a proposed next step.
