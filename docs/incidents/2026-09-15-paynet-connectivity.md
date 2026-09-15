# Intermittent Paynet connectivity

## Status and impact

Payment initialization intermittently returned HTTP 500. Application request
handling has been hardened; provider connectivity remains unresolved at the
time of investigation. A production deployment and a successful payment have
not yet been verified for this change.

## Evidence

Measurements on 2026-09-15, approximately 16:29–16:34 UTC:

- Runtime: Node v22.22.2, OpenSSL 3.5.5, Undici 6.24.1.
- Target: `api.paynet.com.tr:443`.
- Twelve fresh HTTPS requests compared default settings, maximum TLS 1.2 and
  `TLSv1_2_method`: each method succeeded once in four attempts. The remaining
  attempts produced resets or reached the test's 10-second deadline.
- All three successful requests negotiated TLS 1.2 and passed certificate
  verification. Resets occurred before TLS completed. One timed-out request
  completed TLS but received no HTTP headers within the total deadline.
- Independent curl requests from the same server also failed: a TLS reset
  after 0.116 seconds and a TLS timeout after 10.003 seconds. TCP connected
  in approximately 52–60 ms. Google and Cloudflare controls succeeded in
  both rounds, with total durations of 64–98 ms.
- Curl from a second network also showed an intermittent missing response.

The probes used unauthenticated GET requests, not payment creation.

## Findings

The connection problem occurs independently of the application and Node.
Pinning TLS 1.2 is not a demonstrated fix. The evidence does not distinguish
the provider, an intermediate network device or the network path as the cause.

Production lacked initialization error diagnostics that existed in the newer
local controller. Without those logs, individual historical HTTP 500 responses
cannot all be attributed to this connection problem. Separate database errors
remain possible.

## Change

Both Paynet calls now have a 30-second total deadline and structured error
diagnostics. Network and JSON-read failures produce safe customer messages.
Full provider responses and payment URLs are no longer logged by the service.
No TLS override or automatic payment POST retry was added.

The service-level error log works independently of the controller's additional
diagnostics. The change limits waiting and improves investigation; it does not
repair provider connectivity.

## Validation

All 94 tests passed on local Node v24.18.0 and v22.22.2, including 17 Paynet
cases. ESLint passed for the changed JavaScript. A separate production build
with Next.js 16.1.7 and Node v24.18.0 succeeded without production environment
files. These checks do not establish Linux runtime health or a live payment.

## Follow-up

- Obtain provider/hosting findings for the recorded time window.
- Deploy the reviewed change using the correct production source revision.
- Verify production logs and payment behavior after connectivity recovers.
- Record the confirmed cause, deployment revision and recovery time here
  before closing the incident.

See [Payment troubleshooting](../operations/payments.md) for request semantics,
diagnostic commands and deployment considerations.
