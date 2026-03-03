# Platform SDK Public Publishing Design

**Date:** 2026-02-06 **Status:** Approved for implementation **Authors:** Toks
Fawibe, Ryan McAfee (security analysis) **Context:** PLATENG-800 — PR #1188 adds
`@jupiterone/platform-sdk-fetch` (private) as a dependency of `@jupiterone/sdk`
(public). External consumers cannot install private transitive deps.

---

## Problem

`@jupiterone/sdk` is public on npm. PR #1188 replaces `@lifeomic/alpha` with
`@jupiterone/platform-sdk-fetch`, which has
`publishConfig.access: "restricted"`. Five of its transitive `@jupiterone/*`
dependencies are also restricted. External consumers cannot `npm install` the
SDK after this change merges.

## Decision

Make 17 platform-sdk packages public with MPL-2.0 license. This was chosen over:

- **Vendoring the RequestClient** (~400 lines) — Viable but creates maintenance
  burden and divergence from upstream.
- **Using `undici` directly** — Requires rewriting ~460 lines + tests.
  Unnecessary complexity.
- **Bundling with tsdown/tsup** — 8-15 days effort, fragile DTS inlining,
  massive bundle from unused AWS SDK clients. Not recommended.
- **Native `fetch`** — Experimental on Node 18-20 (SDK's target range). Not
  viable until engine constraint is raised to >=21.

## Security Assessment

Ryan McAfee performed a full assessment of all 21 platform-sdk packages.
Independent verification audit confirmed his findings across 107+ source files.

### Classification

| Tier                     | Count | Packages                                                                                                                                                                      |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Safe to publish          | 14    | config-reader, errors, fetch, graphql, koa, logging, message-codec, service, service-plugin-errors, service-plugin-health, service-types, sqs-consumer, test-tools, framework |
| Safe after minor cleanup | 3     | aws, headers, iam                                                                                                                                                             |
| Keep restricted          | 2     | elasticsearch, observability                                                                                                                                                  |
| Keep private             | 2     | benchmark, examples                                                                                                                                                           |

### Findings Summary

- Zero HIGH or CRITICAL issues across all 17 packages
- All hardcoded credentials found are verified LocalStack mocks (`test`/`test`)
- All URLs in source/tests are generic placeholders (`example.com`, `localhost`)
- Common LOW finding: `development@jupiterone.com` team email in `package.json`
  author fields (standard npm convention)
- Common INFORMATIONAL: GitHub usernames and Jira ticket prefixes in CHANGELOGs

## Implementation Plan

### Execution Order

Packages must be published bottom-up (dependencies before dependents):

```
Layer 1 (no @jupiterone deps):
  config-reader, errors, service-types, test-tools, headers*, iam*

Layer 1.5:
  aws* (depends on config-reader)

Layer 2 (depends on Layer 1):
  logging (-> errors)

Layer 3 (depends on Layer 2):
  fetch (-> logging, errors, aws)
  message-codec (-> logging, errors)
  koa (-> logging, errors)
  graphql (-> errors)
  service-plugin-errors (-> errors)
  service-plugin-health (-> errors)
  sqs-consumer (-> logging)
  service (-> logging, errors)

Layer 4 (depends on Layer 3):
  framework (-> config-reader, errors, iam, logging)

* = caution packages requiring minor code fixes
```

Since platform-sdk uses NX with independent versioning in a single monorepo, all
changes go in one PR and publish together.

### Changes

**All 17 packages** — `package.json`:

```diff
- "license": "UNLICENSED",
+ "license": "MPL-2.0",

  "publishConfig": {
-   "access": "restricted"
+   "access": "public"
  }
```

**`platform-sdk-aws`** — `src/config.ts:44`:

```diff
- (awsProfile === 'jupiterone-dev' ? 'us-east-1' : undefined)
+ (process.env.AWS_DEFAULT_REGION || undefined)
```

**`platform-sdk-headers`** — `src/index.ts:120-121`:

```diff
- // The JupiterOne-Forwards-acirciapo header is set by our CF distribution and gateways
- // based on how many additional forwards there are between the CF distribution and the lambda:
+ // The JupiterOne-Forwards-acirciapo header is set by the CDN distribution and gateways
+ // based on how many additional forwards there are between the CDN distribution and the handler:
```

**`platform-sdk-iam`** — No code change. The `lifeomic-*` header names are a
runtime contract across all consumers. Renaming would be a breaking change. Not
a security vulnerability.

**Root** — Add `LICENSE` file with MPL-2.0 text. Update root `package.json`
license to `MPL-2.0`.

### PR Strategy

Single PR to `platform-sdk` repo:

- Title: `chore: publish 17 packages as public with MPL-2.0 license`
- 17 `package.json` updates
- 2 code fixes (aws, headers)
- Root LICENSE file + root package.json license field

### Validation

**Before merge:**

1. CI passes (all existing tests)
2. Verify `platform-sdk-aws` config change doesn't break tests
3. `npm pack` dry-run on a few packages to inspect tarball contents

**After platform-sdk publishes:** 4. Verify public access from unauthenticated
environment:

```
npm view @jupiterone/platform-sdk-fetch
npm view @jupiterone/platform-sdk-errors
npm view @jupiterone/platform-sdk-logging
```

5. Trigger new SDK canary on PR #1188, deploy to dev, check NR logs
6. External consumer simulation:
   `npm install @jupiterone/integration-sdk-runtime@canary` in a clean directory
   without `.npmrc` auth

### Rollback

npm allows deprecating or unpublishing within 72 hours. Security audit confirmed
no sensitive data, so rollback is unlikely to be needed.

### Timeline

1. Create platform-sdk PR — ~1 hour
2. Review & merge — same day
3. Publish completes — automated via CI
4. Validate SDK canary — ~30 minutes
