---
name: scan
description: Scan the current project for production-readiness gaps (rate limiting, auth, secrets, feature flags, images, notifications, cron, search)
---

# Production Readiness Scan

Use the `checkup_scan` MCP tool to scan the current working directory for production-readiness gaps.

Pass the absolute path of the current project as `projectDir`.

Present the findings clearly to the user:
- Group by severity (critical first, then warning, then info)
- For each finding, show the problem, recommendation, and available options
- If there are files listed as evidence, mention them
- Keep the tone helpful and factual — these are suggestions, not mandates

$ARGUMENTS
