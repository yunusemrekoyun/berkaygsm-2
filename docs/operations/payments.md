# Payment troubleshooting

## Paynet request handling

`src/server/services/paynetService.js` calls mailorder create and transaction
check using Node's fetch. Each request has a 30-second deadline covering both
response headers and the complete body. No TLS version override is applied.

| Error code | HTTP status on initialize | Meaning |
| --- | --- | --- |
| `PAYNET_TIMEOUT` | 504 | The application deadline expired. |
| `PAYNET_NETWORK_ERROR` | 502 | Fetch or response-body reading failed. |
| `PAYNET_INVALID_RESPONSE` | 502 | The response was not valid JSON. |

The service logs `paynet: API request failed` with `referanceNo`, `xactId`,
endpoint, phase, elapsed time, HTTP status when available, `errorCode` and
`causeCode`. Phases are `request`, `read_body` and `parse_json`. The request
phase does not distinguish DNS, TCP and TLS failures.

Raw request/response bodies and payment URLs are excluded from these service
diagnostics. Do not add authorization headers, customer details or raw error
objects to the logs.

A timeout does not prove that Paynet rejected the request. Mailorder POSTs are
not automatically retried. Check the provider's records before replaying an
ambiguous operation. A transaction verification failure can send an existing
payment session to manual review; verify the payment before asking a customer
to pay again.

## Investigation

1. Record the timestamp and timezone, affected reference, HTTP status, current
   release and Node version. Correlate application and reverse-proxy logs.
   An HTTP 504 may come from the application deadline or from the proxy;
   check the service error code and proxy error log.
2. Verify that the running process and `current` point to the expected release.
   Source-file edits do not change an already built Next.js server bundle.
3. Compare unauthenticated GET requests to the provider and control hosts from
   the affected server. Keep the hostname so SNI and certificate checks remain
   valid. Do not create payments as a connectivity probe.

   ```bash
   date -u
   for url in https://api.paynet.com.tr/ https://www.cloudflare.com/ https://www.google.com/
   do
     curl -4 -sS -o /dev/null \
       --connect-timeout 10 --max-time 25 \
       -w "target=$url http=%{http_code} ip=%{remote_ip} dns=%{time_namelookup} tcp=%{time_connect} tls=%{time_appconnect} first_byte=%{time_starttransfer} total=%{time_total}\n" \
       "$url"
   done
   ```

4. Repeat a small sample. A single successful request does not establish a fix.
   Curl timings are measured from the start, not the duration of each phase.
   A GET connection check does not validate a payment POST or business logic.
5. If curl and Node both fail for the provider while controls succeed, collect
   the time window, destination, source address and failure phase for provider
   or hosting support. Do not attribute a reset to a specific device without
   supporting network evidence.

Do not disable certificate validation or change the whole process's TLS
settings to work around an unconfirmed cause.

## Deployment and rollback

The production workflow is `.github/workflows/deploy-production.yml`.
`main` is the default branch. Pushes to `main` trigger a deployment; the workflow
also supports manual dispatch. Vercel Git deployments are disabled in
`vercel.json`; production hosting uses the VPS workflow.
The checked-out source is copied to `/home/ceplife/app-src`, then
`ops/vps/deploy.sh` builds a new release under `/srv/ceplife/releases`.

The release contains the Next.js standalone output, static assets, public
files and shared runtime environment. `/srv/ceplife/current` selects the
active standalone directory. PM2 runs as `ceplife`, using
`/home/ceplife/.pm2`, with process name `ceplife-web`.

Before deployment, verify the source revision and diff against the running
version. Record the previous `current` target and retain that release.
Run the tests and build with the intended runtime and configuration. Never
build directly in the active standalone directory.

The deploy script switches `current` and reloads PM2, but has no automatic
health check or rollback. It keeps only the latest five release directories.
After a change, check the application, logs and payment flow. If rollback is
needed, restore the recorded previous standalone target and reload the same
PM2 application as `ceplife`. Recheck the running directory and application
health. Do not use a stale PM2 entry under another user.

## Local checks

```bash
npx vitest run src/server/services/paynetService.test.js
npx eslint src/server/services/paynetService.js src/server/services/paynetService.test.js
```

The tests mock fetch and do not contact Paynet. Build verification in an
environment without production settings is useful for compilation, but its
output is not a production deployment package or an end-to-end payment test.
