# Operations notes

- [Payment troubleshooting](operations/payments.md): request limits, error logs,
  connection checks, deployment and rollback considerations.
- [Paynet connectivity, 2026-09-15](incidents/2026-09-15-paynet-connectivity.md):
  findings and the resulting application changes.
- [VPS migration plan](vps-migration-phase-2.md): historical setup notes.

## Recording an incident

Add `incidents/YYYY-MM-DD-short-description.md` with these sections:

1. **Status and impact** — affected flow, time window and current state.
2. **Evidence** — concise measurements with timezone, environment and method.
3. **Findings** — confirmed facts, likely causes and remaining uncertainty.
4. **Change** — behavior changed and the reason for it.
5. **Validation** — checks performed and what they do not cover.
6. **Follow-up** — remaining actions and the condition for closing the incident.

Update the incident when new evidence arrives. Keep credentials, customer data,
raw production logs, support correspondence and local working notes outside the
repository. Link related operational documentation instead of duplicating it.
