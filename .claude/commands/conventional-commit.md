---
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
description: Create a conventional commit from staged changes
---

## Context

- Current git status: !`git status`
- Staged changes: !`git diff --cached`
- Current branch: !`git branch --show-current`
- Recent commits for style reference: !`git log --oneline -5`

## Your task

Based on the staged changes above, create a conventional commit message following this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

**Rules**:
1. Use the type that best matches the changes
2. Keep subject line under 50 characters
3. Use imperative mood ("add" not "added")
4. Scope is optional but recommended
5. Body should explain the "what" and "why"
6. Add breaking change footer if applicable

Create the commit with this message.
