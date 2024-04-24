# Changelog

All notable changes to the `@jupiterone/integration-sdk-*` projects will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# Unreleased

# 12.6.0 - 2024-04-24

- http-client: add option to pass body as plain text

# 12.5.1 - 2024-04-24

- entity-validator: republish

# 12.5.0 - 2024-04-18

- entity-validator: first release

## 12.4.1 - 2024-04-11

- updated `json-diff` dependency
- removed redudant `??` from `hasCachePath` function

## 12.4.0 - 2024-04-09

- http-client: add default timeout handler

## 12.3.1 - 2024-03-28

- http-client: consume body when paginate's response status is 204 to avoid
  memory leaks

## 12.3.0 - 2024-03-28

- update @jupiterone/data-model
- @jupiterone/data-model has new restrictions on some classes such as Host

## 12.2.7 - 2024-03-27

- update yarn.lock

## 12.2.6 - 2024-03-27

- http-client: upgrade node-fetch to latest 2.x version (2.7.0)

## 12.2.5 - 2024-03-14

- update http-client README.md
- http-client: add method to override default response parse in paginate
- http-client: pass headers to error cause

## 12.2.4 - 2024-03-08

- http-client: fix withBaseUrl method to not encode urls

## 12.2.3 - 2024-03-08

- fix withBaseUrl method on http-client
- add bodyType option to handle both multipart/form-data and application/json on
  http-client

## 12.2.2 - 2024-03-04

- Handle standard and non-standard rate limits in BaseAPIClient.

## 12.2.1 - 2024-03-01

- Fix issues related to pagination and token bucket in BaseAPIClient.

## 12.2.0 - 2024-02-23

- Implement BaseAPIClient in http-client package.

## 12.1.0 - 2024-02-21

- Enhanced step summaries to include `encounteredTypeCounts` property.

## 12.0.0 - 2024-02-01

- Added in `collectEncounteredKeys` to invocation config. This will allow keys
  encountered during the integration to be returned after execution.
- **breaking** Updated interface for `resultsCallback` in `executeIntegration`
  to include the entire job summary.
- Enhanced step summaries to include `startTime`, `endTime`, and `duration`
  properties.

## 11.8.0 - 2024-01-16

- Added `_rawData` property to entity spec by default. This can be overridden
  using `schema: { _rawData: { exclude: true } }`.

## 11.7.1 - 2024-01-09

- Updated types for Jest toImplementSpec matcher

## 11.7.0 - 2024-01-09

- Added option to require all implemented steps to have a spec.

## 11.6.0 - 2024-01-09

- Added in `exclude` option to entity schema which can be used to override
  required properties before validation.

## 11.5.2 - 2023-12-21

- No new changes. Needed to force a new deployment.

## 11.5.1 - 2023-12-20

- No new changes. Needed to force a new deployment.

## 11.5.0 - 2023-12-19

- Introduce `resultsCallback` hook
- Make `IntegrationEntityData.source` optional

## 11.4.0 - 2023-12-14

- Support Node 20.x
- Improved logging for upload errors
- Added `region` and `_key` properties to visualized entities

## 11.3.1 - 2023-11-28

- Patch to fix issue with deployment pipeline not processing

## 11.3.0 - 2023-11-28

- Change Step Start/End logs to debug level and add duration field to Step
  summary

## 11.2.0 - 2023-11-16

- Add `stepConcurrency` to `InvocationConfig` allowing customization of step
  concurrency.

## 11.1.0 - 2023-10-19

- Add `compressUploads` to `CreateAPIClientOptions`. Enabling this will send
  gzipped payloads.

- Allow loading modules by name (ex. @jupiterone/graph-rumble) in the
  `generate-ingestion-sources-config` and `generate-integration-graph-schema`
  commands

## 11.0.3

- Moved `vis` dependency to devDependencies

## 11.0.2

- Republish 11.0.1

## 11.0.1

- **Breaking:** Also remove the deprecated/unused `graphObjectBufferThreshold`
  on the FileSystemGraphObjectStoreParams

## 11.0.0

- **Breaking:** Change `TargetFilterKey` type to only allow composite keys.
  Plain string keys are no longer allowed.

- **Breaking:** Batch size Options removed:
  - Removed unused `--upload-batch-size` and `--upload-relationship-batch-size`
    options from CLI sync commands
  - Removed unused `uploadBatchSize` and `uploadRelationshipBatchSize`
    parameters from programmatic sync methods

## 10.7.1 - 2023-09-26

- Use batching by size as default - and the only option.

## 10.7.0 - 2023-09-21

- Changed the log level of the `Collected metric` log that is published when
  logger.publishMetric is called to "debug"

## 10.6.0 - 2023-09-21

- Release with 10.1.0 changes again:
- 'InMemoryGraphObjectStore' no longer stores a set amount of entities or
  relationships, rather it works by measuring size in bytes of graph objects by
  default.

## 10.5.3 - 2023-09-18

- Use the same logger for all logs created via the `j1-integration run` command
  to improve formatting consistency
- Update internal `err` log serializer

## 10.5.2 - 2023-09-14

- Improvements to integration graph generator

## 10.5.0 - 2023-09-12

- Add `error_unexpected_error` to IntegrationErrorEventName

## 10.4.0 - 2023-09-11

- Revert change in 10.1.0 due to system health issues

## 10.3.0 - 2023-09-07

- Update `jest.js` config to remove deprecated option.
- Add `--noPretty` option to cli to disable pretty printing of logs locally.

## 10.2.0 - 2023-09-01

- Allow user to override `AlphaOptions` in `createApiClient`

## 10.1.0 - 2023-08-28

- 'InMemoryGraphObjectStore' no longer stores a set amount of entities or
  relationships, rather it works by measuring size in bytes of graph objects by
  default.

## 10.0.0 - 2023-08-03

- Bump TypeScript, ESLint, and Prettier to next major versions. Integration
  projects may encounter breaking changes when they adopt these new versions.
  For example, Prettier changed some default formatting. To fix the Prettier
  formatting, you may run the following command:

  `yarn:format` or `prettier --write \"**/*.{ts,js,json,css,md,yml}\"`

## 9.11.1 - 2023-08-01

- Introduce batchingBySize option.

## 9.10.0 - 2023-07-31

- Introduce `executionHandlerWrapper` execution wrapper. See
  [development documentation](./docs/integrations/development.md) for more
  information.

## 9.9.1 - 2023-07-24

### Changed

- Pass an instantiated credential provider to `@lifeomic/alpha` client so that
  credentials stop getting re-loaded when hitting the synchronization API from a
  private endpoint

## 9.8.0 - 2023-07-04

### Added

- Add log for skipped steps for each disabled child step.

## 9.7.0 - 2023-07-05

### Added

- Introduce `afterExecution` integration execution hook. See
  [development documentation](./docs/integrations/development.md) for more
  information.

## 9.6.2 - 2023-06-30

### Updated

Adds logging when an integration fails to initialize or finalize a
synchronization job

## 9.6.0 - 2023-06-30

### Added

Introduces a new feature to `j1-integration` that allows generating a new
integration using a series of inputs.

Example:

```
j1-integration generate
```

## 9.5.0 - 2023-06-19

### Updated

- modify `generateIngestionSourcesConfigCommand` to include child steps metadata
  in the `childIngestionSources` property

## 9.4.1 - 2023-06-07

### Updated

- fix dependencies to be node 18 compatible

## 9.4.0 - 2023-05-11

### Updated

- Updated `@lifeomic/alpha` dependency to `v5.1.1`.

## 9.3.1 - 2023-05-10

### Changed

- Remove steps using the ingestion source id to `childIngestionSources`

## 9.3.0 - 2023-05-09

### Changed

- optimized memory usage in `DuplicateKeyTracker`

## 9.2.0 - 2023-05-03

### Added

- `executeWithContext(context: TExecutionContext, ...)` now accepts a
  `context.instance` property
- modify step start states using ingestionSourcesConfig / disabledSources.

## 9.1.0 - 2023-05-03

### Added

- Added `disabledSources` field to the `IntegrationInstance` type from the
  `@jupiterone/integration-sdk-core` package.

## 9.0.0

### Changed

- **BREAKING** - Bump version of Node.js to v18 and require version >=18.16.0
  <19.x.

- **BREAKING** - Remove asynchronous `jobState.hasKey()`

  The `hasKey` function has no asynchronous implementation, and awaiting
  `jobState.hasKey` can unexpectedly cause duplicate key errors in some specific
  edge cases (see https://github.com/JupiterOne/sdk/pull/694/files).

- Remove the following Node.js event listeners due to Node.js core deprecation:
  - `unhandledRejection`
  - `multipleResolves`

## 8.38.0 - 2023-04-28

### Added

- Add steps using the ingestion source id to `childIngestionSources`

## 8.37.0 - 2023-04-28

### Changed

- Reduced log level of graph object uploads from info to debug

## 8.36.0 - 2023-04-21

### Changed

- Set the integrationJobId to the syncJob's integrationJobId if a job id was not
  passed in in the jobConfiguration.

## 8.35.0 - 2023-04-12

### Added

- Add a new field `ingestionConfig` to the `invocationConfig` in
  `@jupiterone/integration-sdk-core`. This is used to store information about
  data ingestion sources that can be enabled or disabled.
- Add new command `generate-ingestion-sources-config` in
  `@jupiterone/integration-sdk cli`. This is used to create e new file
  `ingestionSourcesConfig.json` and store it in a s3 bucket.

## 8.34.0 - 2023-04-11

### Added

- Added support for `json` environment variables. Example:

`.env` file:

```
// .env
SEVERITIES=["HIGH", "CRITICAL"]
```

Code:

```ts
import { Client } from './client';
import { createVulnEntity } from './converter';

type IntegrationConfig = { apiKey: string; severities: string[] };
const invocationConfig: IntegrationInvocationConfig = {
  instanceConfigFields: [
    {
      apiKey: { type: 'string', mask: true },
      severities: { type: 'json' },
    },
  ],
  integrationSteps: [
    {
      id: 'fetch-vulnerabilities',
      name: 'Fetch Vulnerabilities',
      entities: [{ resourceName: 'Vuln', _type: 'vuln', _class: 'Finding' }],
      relationships: [],
      executionHandler: ({ instance }) => {
        const { apiKey, severities } = instance.config;
        const client = new Client({ apiKey });

        await iterateVulnerabilitiesForSeverity(
          { severities },
          async (vuln) => {
            await jobState.addEntity(createVulnEntity(vuln));
          },
        );
      },
    },
  ],
};
```

## 8.33.1 - 2023-04-03

### Fixed

- Fixed assigning empty tags not working if tags have `Value` property rather
  than `value`.

## 8.33.0 - 2023-04-03

### Changed

- The presence of TypeScript deceleration files will no longer trigger the
  loading of ts-node to run the project.

## 8.32.0 - 2023-03-27

- **BREAKING** - Require Node.js version >=14.17.0 <15.x due to replacement of
  `uuid` module with `crypto` `randomUUID`

## 8.31.1 - 2023-03-24

### Fixed

- Update automatic integration documentation generator strategy to avoid
  creating duplicate records for entities, relationships, and mapped
  relationships.

## 8.31.0 - 2023-03-20

- Add `collectEntities` and `collectRelationships` functions to
  `InMemoryGraphObjectStore`.

## 8.30.5 - 2023-03-01

- Update `@jupiterone/date-model` to version v0.54.0

## 8.30.4 - 2023-02-20

- Update `assignTags()` to add keys with `value: ''` to entity `.tags` property

## 8.30.2 - 2023-02-08

### Added

- Added `troubleshoot` command to CLI to help diagnose problems with local
  execution of integrations.

## 8.30.2 - 2023-02-08

### Added

- Added DisabledStepReason.API_VERSION for use when the version of a third party
  API does not support a given step.

## 8.30.1 - 2023-01-10

### Added

- Added new `DuplicateEntityReport` when an integration errors with a duplicate
  **\_key**.

## 8.30.0 - 2022-12-20

### Changed

- Step summary refactored to be `summary.$TYPE: { total: number }`. This will
  enable better logs querying.

## 8.29.3 - 2022-11-28

### Fixed

- Do not modify the value supplied to `JUPITERONE_API_KEY` when using the
  integration CLI

## 8.29.2 - 2022-11-15

### Fixed

- Fixed incorrect path of import in `getStepExecutionOrder`

## 8.29.0 - 2022-11-15

### Changed

- Added option to allow duplicate types in `getSortedJupiterOneTypes`
- Changed `j1-integration document` command to allow duplicate types
- Added optional `dependencyStepIds` to `StepTestConfig`
- Added support for `dependencyGraphId` to `executeStepWithDependencies`

## 8.28.1 - 2022-11-9

### Changed

- Updated `@jupiterone/data-model` version to add `RelationshipClass.PUBLISHES`

## 8.28.0 - 2022-10-18

- Publish the following new custom metrics when entities, relationships, and
  mapped relationships are added to the `JobState` respectively:
  - `collected_entities`
  - `collected_relationships`
  - `collected_mapped_relationships`

## 8.27.1 - 2022-10-16

- Added log in `uploadDataChunk` to capture successful completion of an upload

## 8.27.0 - 2022-10-16

### Changed

- Allow disabling the collection of the disk usage metric by specifying the
  `DISABLE_DISK_USAGE_METRIC` environment variable

## 8.26.0 - 2022-10-12

### Changed

- `multipleResolves` events are no longer forwarded to loggers `onFailure`
  callback as they are not strict failures. Logging of `multipleResolves` at log
- Updated ESLint to override the `no-misused-promises` rule.

## 8.25.1 - 2022-09-26

### Changed

- Skip logging messages when `logged_error` and `logged_warn` metrics are
  emitted.

## 8.25.0 - 2022-09-26

### Added

- Emit `logged_error` and `logged_warn` metric counters when `IntegrationLogger`
  `logger.error` and `logger.warn` are called respectively.

## 8.24.1 - 2022-09-21

### Fixed

- Allow relationships to have `undefined` top-level properties

### Added

- Add no-console lint rule to catch console.log accidentally left in projects.
  Note: Possible breakage when this changes is adopted. The rule can be ignored
  if needed using `/* eslint-disable no-console */`
- `j1-integration sync` now supports the `--skip-finalize` option to avoid
  finalizing the synchronization job. This brings parity with the `run` command.
- `j1-integration` `run` and `sync` commands now support `--account` and
  `--api-key` options to make them consistent with other commands that support
  these options. The values provided to these options will override any values
  set in the `JUPITERONE_ACCOUNT` and `JUPITERONE_API_KEY` environment
  variables. Note: it is recommended to avoid `--api-key` in a CI/CD or server
  environment because the values will be visible in the logs.

### Changed

- Upgrade CLI `commander` dependency to improve options type safety and
  handling.
- Changed some CLI options error messages to be consistent and clearer. Any
  scripts that were relying on the previous error messages will need to be
  updated.
- CLI `--development` option can be set to `"true"` when `--api-base-url` is
  either of `https://api.us.jupiterone.io` or `https://api.dev.jupiterone.io`
  (an error will not be thrown). This allowed for declaring the default value of
  `--api-base-url` so it is shown in the help output. Any other value for
  `--api-base-url` will cause an error to be thrown if `--development` is set to
  `"true"`.

## 8.24.0 - 2022-09-15

### Added

- `j1-integration run --skip-finalize` option to avoid finalizing the
  integration run. This is useful for scenarios where you want to run the
  integration to collect and upload data to a synchronization job, but do not
  want to initiate the finalization process.
- `j1-integration [run|sync] --source api --scope anystring` options to allow
  use of the SDK without configuring an integration instance.
  `--integrationInstanceId` is not required when using these options.

## 8.23.1 - 2022-09-07

### Fixed

- Support backwards compatibility for old integration npm package dist format
  when using `j1-integration generate-integration-graph-schema`.

  The way that integration npm packages are distributed has changed over time.
  We are now handling invocation config loading from different file paths to
  support backwards compatibility and make adoption easier.

## 8.23.0 - 2022-09-06

### Added

- Added `graphObjectFileSize` configuration option to
  `FileSystemGraphObjectStore`

## 8.22.7 - 2022-09-03

### Added

- Added optional flag to specify a different Neo4j database name to push to or
  wipe from than the default 'neo4j' (only available on enterprise instances of
  Neo4j).

## 8.22.5 - 2022-08-24

### Fixed

- Allow the use of possibly null or undefined `number` in
  `parseTimePropertyValue`

## 8.22.2 - 2022-08-18

### Added

- Added `optional` parameter to `IntegrationInstanceConfigField`.
- Update `ProviderSourceData` `tags` type to match `assignTags`

## 8.22.0 - 2021-07-20

- Support async `beforeAddRelationship` hook in `IntegrationInvocationConfig`.
  See the development documentation for more information on its usage.

## 8.21.0 - 2021-07-20

### Added

- Added `IntegrationInfoEventName.Results` and
  `IntegrationWarnEventName.MissingEntity`.

## 8.20.0 - 2021-07-16

### Added

- Introduce `beforeAddRelationship` hook into `IntegrationInvocationConfig`. See
  the development documentation for more information on its usage.

## [8.19.0] - 2022-07-07

### Added

- New `j1-integration generate-integration-graph-schema` CLI command added

```
Usage: j1-integration generate-integration-graph-schema [options]

generate integration graph metadata summary from step metadata

Options:
  -o, --output-file <path>        project relative path to generated integration graph schema file
  -p, --project-path <directory>  path to integration project directory (default: "{CWD}")
  -h, --help                      display help for command
```

## [8.18.1] - 2022-07-05

### Changed

- Bumped `@jupiterone/data-model@v0.51.0`

## [8.18.0] - 2022-07-01

### Added

- Added the ability to specify a reason for why a step is disabled. This can be
  set in the `StepStartState` interface using the `DisabledStepReason` enum.
  Valid reasons include: `PERMISSION`, `CONFIG`, `BETA`, and `NONE`. `NONE` is
  the equivalent to not specifying a reason. If `NONE` or undefined are
  specified, logging to the job event log is disabled. Here is an example of
  usage:

```typescript
{
  ['fetch-prs']: {
    disabled: false
  },
  ['fetch-issues']: {
    disabled: !scopes.repoIssues,
    disabledReason: DisabledStepReason.PERMISSION
  }
}
```

Sample text output:

```
Skipped step "Fetch Issues". The required permission was not provided to perform this step.
Skipped step "Fetch Issues". This step is disabled via configuration. Please contact support to enabled.
Skipped step "Fetch Issues". Beta feature, please contact support to enable.
```

## [8.17.0] - 2022-06-29

### Added

- Added ability to set a separate `uploadRelationshipsBatchSize`. `sync` and
  `run` commands can specify the relationship-specific batch size with the `-ur`
  or `--upload-relationship-batch-size` flags. Existing behavior remains the
  same. If a `uploadBatchSize` is set, but no `uploadRelationshipsBatchSize`,
  then relationships will be uploaded in batches of size `uploadBatchSize`.

## [8.16.0] - 2022-06-27

### Added

- Added an optional `encounteredEntityKeys` property on `.toMatchStepMetadata()`
  to verify that any relationship `_fromEntityKey` and `_toEntityKey` has
  actually been encountered in the job state.

## [8.15.0] - 2022-06-22

### Changed

- `@jupiterone/data-model` has been bumped to `0.50.0`

## [8.14.1] - 2022-06-17

### Added

- `j1-integration` `sync` and `run` commands now have the option
  `--upload-batch-size` to specify how many objects to upload in each batch.

## [8.14.0] - 2022-06-13

### Added

- `j1-integration` now has the command `visualize-dependencies` to create a
  visualization of the integration's step dependencies.

## [8.13.13] - 2022-06-09

### Changed

- Fixed publish lerna command.

## [8.13.12] - 2022-06-08

### Changed

- Allow an integration job id to be passed in when initializing syncronization.

## [8.13.11] - 2022-05-27

### Changed

- `j1-integration run` command now supports `--disable-schema-validation` flag.

## [8.13.10] - 2022-05-20

### Changed

- Bumped version `@jupiterone/data-model` to v0.49.0

## [8.13.9] - 2022-05-20

### Fixed

- Fixed issue when unzipping gzipped polly recording entries. Now removes the
  content.encoding value once content is decoded.
- Fixes issue introduced in 8.13.4

## [8.13.8] - 2022-05-19

### Changed

- Moved `shrinkBatchRawData` to its own module for readablity and easy mocking
  in test
- Increased threshold by which we continue to shrink rawData from 6 million
  bytes to 5.5 million bytes
- change core loop of `shrinkBatchRawData` to a `do while` loop instead of
  `while`. This guarantees that at least 1 property will be attempted to be
  truncated on each call to `shrinkBatchRawData`. We only call this function
  when there has been an upload error due to payload size.

## [8.13.7] - 2022-05-18

### Changed

- Bumped version `@jupiterone/data-model` to v0.48.0

## [8.13.6] - 2022-05-12

### Fixed

- Neo4j uploads no longer occasionally create duplicate nodes on relationship
  creation.

## [8.13.5] - 2022-05-11

### Fixed

- Hanging execution when encountering upload failure due to entity properties
  being too large
- add logging surrounding the size distribution of upload batch and its largest
  entity when such a situation occurs
- throw fatal error when such a situation occurs

## [8.13.4] - 2022-05-10

### Fixed

- Added base64 support for unzipping gzipped polly recording entries.

## [8.13.2] - 2022-05-05

### Changed

- Updated Neo4j upload commands to improve performance.

## [8.13.1] - 2022-04-27

## Fixed

- Fixed CodeQL warning around Neo4j value sanitization previously not properly
  accounting for potential escape characters.

## [8.13.0] - 2022-04-26

## Added

- Initial release of HTTP client with basic rate limit retry handling.

## [8.12.1] - 2022-04-26

## Changed

- Updated dependency `@lifeomic/attempt` to version 3.0.3 Fixes an error
  handling issues when using the timeout option.

## [8.12.0] - 2022-04-20

### Changed

- The following packages have been upgraded:

  - `@pollyjs/adapter-node-http`
  - `@pollyjs/core`
  - `@pollyjs/persister-fs`

- The new Polly.JS packages ship with TypeScript definition files, so the old
  `@type/pollyjs__` packages have been removed

- Support `executeStepWithDependencies` for steps with no `dependencyGraphId`,
  even if `invocationConfig.dependencyGraphOrder` is present

## [8.11.0] - 2022-04-11

### Added

- Additional error type `IntegrationProviderRetriesExceededError` to be used
  when integration has exhausted all of the retries. This error type won't be
  sent in as an alert to the operators.

## [8.10.1] - 2022-04-08

### Changed

- Reduced max upload size to 1 MB.

## [8.10.0] - 2022-04-07

### Changed

- Additional logging when upload errors occur

## [8.9.0] - 2022-04-05

### Changed

- Bumped version `@jupiterone/data-model` to v0.47.0

## [8.8.2] - 2022-04-04

### Added

- `j1` commands `export` and `import` now accept optional command parameter
  --api-base-url to specify a different URL to run against.

## [8.8.1] - 2022-04-01

### Added

- `j1-integration` commands `sync`, `run`, and `validate-question-file` now
  accept optional command parameter --api-base-url to specify a different URL to
  run against.

## [8.8.0] - 2022-03-28

### Added

- SDK now proactively truncates rawData entries when uploads would exceed 6
  megabytes.

## [8.7.0] - 2022-03-25

### Changed

- Bumped version of `@jupiterone/data-model` to v0.46.0

### Added

- pass client-generated correlation id with sync job uploads

## [8.6.4] - 2022-03-23

### Changed

- Log error `code` when an integration logs an error
- Throw an `IntegrationError` with code `INTEGRATION_UPLOAD_FAILED` when the
  JupiterOne system responds with `RequestEntityTooLargeException`

### Fixed

- [#660] - Trigger fatal error when JupiterOne system responds with
  `JOB_NOT_AWAITING_UPLOADS`

## [8.6.3] - 2022-03-17

### Fixed

- Fixed an error where if `retryOptions` was `undefined` default options would
  not be adopted

## [8.6.2] - 2022-03-17

### Added

- `retryOptions` parameter to `createApiClient` to allow configuration of the
  retry behavior for `Alpha`

## [8.6.1] - 2022-03-14

### Fixed

- Neo4j uploads now include all properties for mapped entities.

## [8.6.0] - 2022-03-07

### Added

`IngestionLimitEncountered` type to IntegrationErrorEventName and
IntegrationWarnEventName.

## [8.5.0] - 2022-03-05

### Changed

- Bumped version of `@jupiterone/data-model` to v0.45.0

## [8.4.6] - 2022-03-03

Add support for empty string values to assignTags.

## [8.4.5] - 2022-02-23

Export EntityCoreProperties to all type inference to work outside this project.

## [8.4.4] - 2022-02-22

Fix #638 - The Neo4j ingestion tool was ignoring properties with the value
`false`.

With this fix, the following query is supported:

```cy
MATCH (user:User {
  mfaEnabled: false
}) RETURN user
```

## [8.4.3] - 2022-02-22

### Added

- [#633](https://github.com/JupiterOne/sdk/issues/633) Support `_class` as a
  node label property for entities created by the Neo4j store.

Example query by `_type`:

```cy
MATCH (account:github_account)-[OWNS]->
  (repo:github_repo)-[ALLOWS]->
  (user:github_user {
    role:"OUTSIDE"
  })
RETURN account, repo, user
```

Example query by `_class`:

```cy
MATCH (account:Account)-[OWNS]->
  (repo:CodeRepo)-[ALLOWS]->
  (user:User {
    role:"OUTSIDE"
  })
RETURN account, repo, user
```

### Fixed

- All types and classes used for labels are now being sanitized.

## [8.4.2] - 2022-02-19

### Fixed

Fix [#629](https://github.com/JupiterOne/sdk/issues/629) - Create relationships
from Neo4j store using `_class` as the label instead of `_type`

> Which GitHub repositories are accessible to outside collaborators?

Old query:

```cy
MATCH (n:github_repo)-[r:github_repo_allows_user]->(u:github_user{role:"OUTSIDE"})
RETURN n, u

MATCH (account:github_account)-[github_account_owns_repo]->
  (repo:github_repo)-[github_repo_allows_user]->
  (user:github_user {
    role:"OUTSIDE"
  })
RETURN account, repo, user
```

New query:

```cy
MATCH (account:github_account)-[OWNS]->
  (repo:github_repo)-[ALLOWS]->
  (user:github_user {
    role:"OUTSIDE"
  })
RETURN account, repo, user
```

## [8.4.1] - 2022-02-17

### Fixed

- Bumped `@types/jest@^27.1.0` in order to fix **Namespace 'NodeJS' has no
  exported member 'Global'.** issues captured here:
  https://github.com/facebook/jest/issues/11640

## [8.4.0] - 2022-02-16

### Fixed

- Changed logger to fully mask config field values, rather than displaying last
  4 chars

### Added

- Added `.toMatchStepMetadata` jest matcher. This matcher complements the
  `executeStepWithDependencies` utility. Usage:

  ```ts
  const stepResult = await executeStepWithDependencies({
    stepId: Steps.FETCH_USERS.id,
    invocationConfig,
    instanceConfig,
  });

  expect(stepResult).toMatchStepMetadata({
    stepId: Steps.FETCH_USERS.id,
    invocationConfig,
  });
  ```

- Updated jest matchers in the following way:

  - added optional `_type` argument to `.toMatchGraphObjectSchema` matcher
  - added optional `_type` and `_class` arguments to
    `.toMatchDirectRelationshipSchema` matcher

  This enables developers to simply pass the `StepEntityMetadata` and
  `StepRelationshipMetadata` interfaces to these matchers. Usage:

  ```ts
  expect(collectedEntities).toMatchGraphObjectSchema(Entities.USER);
  expect(collectedRelationships).toMatchDirectRelationshipSchema(
    Relationships.ACCOUNT_HAS_USER,
  );
  ```

- Added optional `schema` property to `StepGraphObjectMetadata`. This allows
  developers to provide the property schema to expect on entities,
  relationships, and mapped relationships. This serves two uses:
  1. Schemas can be used at runtime or test-time to verify that an entity has
     the correct properties
  2. The `j1-integration document` command could automatically produce consumer
     documentation about the properties that an entity / relationship is
     expected to have
- Added `executeStepWithDependencies` utility to
  `@jupiterone/integration-sdk-testing` package. This allows developers to test
  specific integration steps in isolation, while assuring that all of its
  dependencies have indeed executed. Usage:

  ```ts
  const { collectedEntities, collectedRelationships, collectedData } =
    await executeStepWithDependencies({
      stepId: Steps.FETCH_USERS.id,
      invocationConfig,
      instanceConfig,
    });

  expect(collectedEntities.length).toBeGreaterThan(0);
  expect(collectedEnities).toMatchGraphObjectSchema({
    _class: Entities.USER._class,
    schema: Entities.USER.schema,
  });
  // ... additional expectations
  ```

- Added `MockJobState.collectedData` to capture data that has been collected in
  the job state. Usage:

  ```ts
  const jobState = createMockJobState({
    setData: { existingKey: 'existing-value' },
  });
  await executeStepThatAddsAccountEntity();

  expect(jobState.collectedData).toEqual({
    ACCOUNT_ENTITY: {
      _type: 'account',
      _class: 'Account',
      _key: 'account1',
    },
  });
  expect(jobState.collectedData.existingKey).toBeUndefined();
  ```

## [8.3.2] - 2022-02-09

### Added

- Added ability to disable matching class schema in toMatchGraphObjectSchema

## [8.3.1] - 2022-02-07

### Fixed

- Fixed [#603](https://github.com/JupiterOne/sdk/issues/603) - Add missing
  `chalk` production dependency to `@jupiterone/integration-sdk-cli`

## [8.3.0] - 2022-02-03

### Changed

- Bumped version of `@jupiterone/data-model` to add `state` property to `Host`
  entity class

## [8.2.1] - 2022-01-25

### Changed

Updated the error message within the sdk-core to reference support email instead
of the support.jupiterone.io site.

## [8.2.0] - 2022-01-12

### Added

- Added the `loadExecutionConfig` lifecycle method to the `InvocationConfig`
  interface. `loadExecutionConfig` loads shared configuration assets, such as
  shared API credentials. Example:

  ```ts
  import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';

  /**
   * The AWS integration uses shared `fromTemporaryCredentials` across all of
   * its clients.
   */
  export function loadExecutionConfig({
    config: { roleArn: string, externalId: string },
  }) {
    return {
      credentials: fromTemporaryCredentials({
        params: {
          RoleArn: config.roleArn,
          ExternalId: config.externalId,
          RoleSessionName: `juptierone-${uuid()}`,
        },
      }),
    };
  }
  ```

## [8.1.3] - 2022-01-11

### Changed

- Bump `@jupiterone/data-model` to expose `RelationshipClass.SENDS`

## [8.1.2] - 2022-01-04

### Changed

- Bump `@jupiterone/data-model` to remove warning messages for `User` and
  `Person` entities

## [8.1.1] - 2022-01-04

### Fixed

- Fixed an issue where the `j1-integration neo4j` command was calling
  `toString()` on undefined properties in some cases

## [8.1.0] - 2021-12-17

### Changed

- Bump `@jupiterone/data-model` to expose `RelationshipClass.HOSTS` and
  `RelationshipClass.LOGS`

## [8.0.0] - 2021-12-15

### Added

- CLI now has a command called `neo4j` that will upload any collected data in a
  project to a local Neo4j database. This requires that a NEO4J_URI, NEO4J_USER,
  and NEO4J_PASSWORD be supplied in the local .env file.

## [7.4.1] - 2021-11-03

### Changed

- **\*BREAKING\*** Explicitly require a `_key` property when using
  `createIntegrationEntity()`. Previously, the `createIntegrationEntity()`
  function allowed the `_key` property to be _optional_, and when not present,
  the function automatically uses either `id` or `providerId` as the entity
  `_key`.

  This caused (entirely preventable) runtime errors if the given `source` data
  did not have an `id` or `providerId` property available.

- Updated the interfaces for `jobState.findEntity` and `jobState.hasKey` to
  allow `undefined`. Oftentimes, we use optional chaining with
  `jobState.findEntity` or `jobState.hasKey`, so having the ability to pass
  `undefined` into these methods can make our code easier to read.

  ```ts
  // without allowing `undefined`, we often need to assert values as `string`
  const virtualMachineId = await jobState.findEntity(
    nic.virtualMachine?.id as string,
  );

  // by allowing `undefined`, we can more safely use these methods without type assertions
  const virtualMachineId = await jobState.findEntity(nic.virtualMachine?.id);
  ```

### Fixed

- Fixed the way that symlinks are created on windows machines. Directories are
  still created as simlinks, but files are now hardlinks to prevent the
  requirement that `yarn start` be run with admin credentials.

## [7.4.0] - 2021-11-03

### Changed

- Bump `@pollyjs` packages in `@jupiterone/integration-sdk-testing` and
  `@jupiterone/integration-sdk-cli`

## [7.3.0] - 2021-10-25

### Changed

- Bump `@jupiterone/data-model` to expose `VIOLATES` relationship class.

## [7.2.0] - 2021-10-22

### Added

- [#567](https://github.com/JupiterOne/sdk/issues/567) - Add utility function
  that truncates an entity property value

## [7.1.1] - 2021-10-21

### Changed

- Do not retry `RequestEntityTooLargeException`s

## [7.1.0] - 2021-10-15

### Added

- Added support to publish job log events at level `info`, `warn`, and `error`.

  Usage:

  ```ts
  logger.publishInfoEvent({
    name: IntegrationErrorEventName.Stats,
    description: 'fetched 100000 records',
  });
  logger.publishWarnEvent({
    name: IntegrationErrorEventName.MissingPermission,
    description: 'Missing permission users.read',
  });
  logger.publishErrorEvent({
    name: IntegrationErrorEventName.MissingPermission,
    description: 'Missing permission users.read',
  });
  ```

- Added support for relative paths in `yarn j1-integration *` commands

## [7.0.0] - 2021-10-05

### Changed

- Drop support for any version below Node 14.x. The build now only targets 14.x

## [6.22.1] - 2021-10-04

### Changed

- When an `IntegrationError` receives a `cause` property, append `cause.stack`
  to the error's stack trace

## [6.22.0] - 2021-09-30

### Changed

- Bump `@jupiterone/data-model` to expose `Issue` entity class.

## [6.21.0] - 2021-09-28

- Use the default path `{CWD}/jupiterone/questions/questions.yaml` for the
  `--file-path` argument of `j1-integration validate-question-file`

### Added

## [6.20.0] - 2021-09-26

### Added

- Introduce `j1-integration validate-question-file` command that is used to
  automatically validate managed questions and JupiterOne queries

## [6.19.0] - 2021-09-09

### Added

- Added `toImplementSpec` jest matcher
- Added `StepSpec` and `IntegrationSpecConfig` types in order to define
  integration specifications

### Changed

- Changed language for relationships created that document command produces.

## [6.18.0] - 2021-08-27

### Added

- Add mapped relationship details to documentation output

### Changed

- Bump `@jupiterone/data-model` to expose `Secret` entity class.

## [6.17.0] - 2021-08-27

### Changed

- Bump `@jupiterone/data-model` to expose `Question` entity class.

## [6.16.1] - 2021-08-27

### Changed

- Bump `@jupiterone/data-model` to expose `RelationshipClass.ENFORCES`

## [6.16.0] - 2021-08-25

### Added

- Add `j1-integration collect --project-path` to allow for executing against a
  project in any location
- Add `j1-integration sync --project-path` to allow for executing against a
  project in any location
- Add `j1-integration run --project-path` to allow for executing against a
  project in any location
- Add `j1-integration run --development` to match other commands that connect to
  JupiterOne development environment
- Add `j1-integration visualize --output-file` to allow for specifying the
  output file path
- Add the `j1-integration visualize --data-dir` value to the error content of
  the generated file when there were no entities or relationships to render

### Changed

- Improve grammar and consistency of CLI help content
- Change `j1-integration visualize --data-dir` to support absolute path,
  complementing added support for `--project-path` on other commands

### Fixed

- Fix `j1-integration document --output-file` to reflect that it is a path
  relative to `--project-path`
- Fixed the way that symlinks are created on windows machines, which previously
  threw `EPERM: operation not permitted, symlink`

## [6.15.0] - 2021-08-19

### Added

- Add optional `mappedRelationships` to step metadata

## 6.14.0 - 2021-08-04

### Changed

- Changed how `j1-integration visualize` displays placeholder entities. Now only
  properties present in `targetFilterKeys` are displayed in the graph, making
  target entities smaller. Also, set borders of placeholder entities to dashed.
- Bump `@jupiterone/data-model` to expose `Alert` entity schema.
- `createEventPublishingQueue` takes in an optional Axios config.

## 6.13.0 - 2021-07-28

### Added

- Track summary of collected graph object `_type`'s and the number of times that
  each `_type` has been encountered

## 6.12.0 - 2021-07-27

### Changed

- Bump `@jupiterone/data-model` to expose `Problem` entity schema.

## 6.11.1 - 2021-07-23

### Changed

- A single DataStore is now used for all dependency graphs executed in an
  integration run.
- Used default J1 colors for `yarn j1-integration visualize-types` command.

## 6.11.0 - 2021-07-14

### Added

- a `dependencyGraphOrder` property to the InvocationConfig and a
  `dependencyGraphId` property to the StepMetadata which togeather can be used
  to create multiple ordered dependency graphs per execution.

## 6.10.0 - 2021-07-09

### Changed

- Bump `@jupiterone/data-model` to incorporate `RelationshipClass.PUBLISHED`

## 6.9.0 - 2021-07-06

### Added

- Added `deleteData()` for jobState Usage:
  ```typescript
  await jobState.setData('abc', true);
  await jobState.getData('abc'); // true
  await jobState.deleteData('abc'); // void
  await jobState.getData('abc'); // undefined
  ```
- Added `development` option to `j1-integration sync` command.

### Removed

- Removed `j1-integration compare` command. Developers should use
  `j1-integration diff` in its place.

## 6.8.0 - 2021-06-29

### Added

- Added `j1-integration diff` command to ouptut colorized diffs of old/new
  integrations.
- Allow overriding integration instance properties when running integrations
  locally.

## 6.7.1 - 2021-06-29

### Fixed

- [#494](https://github.com/JupiterOne/sdk/issues/494) - Expose 401 Unauthorized
  errors from synchronization API

## 6.7.0 - 2021-06-10

### Changed

- Upgrade `@jupiterone/data-model@^0.30.0`

### Added

- Added `toTargetEntities()` jest matcher for mapped relationship validation.
  Usage:
  ```typescript
  expect([mappedRel1, mappedRel2]).toTargetEntities([
    entity1,
    entity2,
    entity3,
  ]);
  ```

### Changed

- Expanded the interface of `findEntity` to accept `string | undefined`.

## 6.6.0 - 2021-06-010

### Changed

- Upgrade `@jupiterone/data-model@^0.28.0`
- Fix missing CLI `compare` sub command.
- Fix `compare` relationship key tracking.
- Ignore metadata graph object properties in `compare`.

## 6.5.0 - 2021-06-05

### Changed

- Upgrade `@jupiterone/data-model@^0.27.0`

## 6.4.0 - 2021-06-03

### Changed

- Add `compare` method to `@jupiterone/integration-sdk-cli` which is used to
  diff data sets downloaded from JupiterOne.

## 6.3.0 - 2021-05-25

### Changed

- Upgrade `@jupiterone/data-model@^0.24.0`

## 6.2.1 - 2021-05-24

### Changed

- Upgrade `@jupiterone/data-model@^0.22.2`

## 6.2.0 - 2021-05-21

### Added

- [#470](https://github.com/JupiterOne/sdk/issues/470) Introduce
  `beforeAddEntity` hook into `IntegrationInvocationConfig`. See the development
  documentation for more information on its usage.

## 6.1.0 - 2021-05-19

### Changed

- Upgrade `@jupiterone/data-model@^0.22.1`

## 6.0.1 - 2021-05-10

### Changed

- Upgrade `@jupiterone/data-model@^0.22.0`

## 6.0.0 - 2021-04-19

### Changed

- Improved the performance of `jobState.findEntity()` when entities are written
  on disk.
- Removed `GraphObjectStore.getEntity()`, and added `.findEntity()` to the
  specification.

## 5.12.0 - 2021-04-16

### Changed

- `parseStringPropertyValue()` accepts `string | undefined | null` as a
  convenience for cases where provider data answers `undefined` or `null`
  values.
- Updated numerous dependencies, including `typescript` and `eslint`.

### Fixed

- `IntegrationProviderAuthorizationError` and
  `IntegrationProviderAuthenticationError` constructors were not compatible with
  `IntegrationProviderAPIError`, making for linting errors in projects that
  would expect them to be.

## 5.11.0 - 2021-03-16

- Upgrade `@jupiterone/data-model@^0.18.0`

## 5.10.0 - 2021-03-05

### Changed

- Additional logged information in uploads error case

## 5.9.0 - 2021-03-05

### Changed

- Additional logged information in uploads

## 5.8.2 - 2021-03-04

### Fixed

- [#429](https://github.com/JupiterOne/sdk/issues/429) - fixed
  `toMatchGraphObjectSchema` failure when multiple classes share same `enum`
  property name.

## 5.8.1 - 2021-03-03

### Fixed

- [#426](https://github.com/JupiterOne/sdk/issues/426) - Update return typings
  for `jobState.getData` to be more realistic

Old:

```ts
getData: <T,>(key: string) => Promise<T>;
```

New:

```ts
getData: <T,>(key: string) => Promise<T | undefined>;
```

## 5.8.0 - 2021-02-26

### Changed

- Updated packages in `@jupiterone/integration-sdk-core`

## 5.7.0 - 2021-02-15

### Added

- Expose the following read-only properties on `IntegrationProviderAPIError`
  - `endpoint`
  - `status`
  - `statusText`

## 5.6.2 - 2021-02-09

### Added

- Added log statement after `uploadData()` successfully sends data to
  synchronizer.

## 5.6.1 - 2021-01-20

### Fixed

- Allow duplicate key tracker to grow greater than V8 engine limit. See
  [#420](https://github.com/JupiterOne/sdk/pull/420).

## 5.6.0 - 2021-01-14

### Added

- Whitespace trimming of integration config values.
- Support for skipping writing graph object files when running CLI commands

### Changed

- Skip logging warn message when a `CredentialsError` is received in graph
  object uploads.

## 5.5.0 - 2021-01-02

### Added

- Support for specifying the upload batch size via the `uploadBatchSize` in
  `createPersisterApiStepGraphObjectDataUploader`.

## 5.4.0 - 2020-12-31

### Added

- `JobState.hasKey()` as an efficient means of determining whether an entity or
  relationship has been added. This allows integrations to avoid doing any of
  their own key tracking.

### Fixed

- A `createIntegrationEntity` bug in transferring source properties into an
  entity caused a memory leak.

## 5.3.0 - 2020-12-27

### Added

- Support for omitting specific graph objects from file storage. Some entities
  and relationships do not need to be stored on the file system at all. We only
  need to store graph objects on the file system if we later intend to fetch the
  data from the job state or iterate over the `_type`.

  Usage in an integration step:

  ```typescript
  {
    id: 'my-step',
    name: 'My step',
    entities: [
      {
        resourceName: 'The Record',
        _type: 'my_record',
        _class: ['Record'],
        indexMetadata: {
          // This _type will not be written to the file system
          enabled: false,
        },
      },
    ],
    relationships: [],
    async exeutionHandler() {
      ...
    }
  }
  ```

  See PR [#404](https://github.com/JupiterOne/sdk/pull/404)

## 5.2.1 - 2020-12-23

### Fixed

- Fixed issue where the SDK could upload empty entity and relationship graph
  object files.

## 5.2.0 - 2020-12-18

### Changed

- OPTIMIZATION: Buffer entities and relationships in memory and allow for fast
  lookups. This change allows us to skip flushing to disk anytime there is a
  call to `findEntity`, `iterateEntities` or `iterateRelationships`.

  See PR [#395](https://github.com/JupiterOne/sdk/pull/395)

- OPTIMIZATION: Allow `FileSystemGraphObjectStore` to specify
  `graphObjectBufferThreshold`, which defines the maximum number of graph
  objects that the graph object store can buffer into memory before flushing to
  disk. Machines with more memory should consider increasing this value as the
  default is `500`.

  See PR [#395](https://github.com/JupiterOne/sdk/pull/395)

- OPTIMIZATION: Continuously upload integration data during collection phase.
  Previously, our integrations had two primary phases. The first phase was the
  collection phase, and the second phase was the upload phase. The integration
  SDK now mixes these two phases and the integrations will upload the collected
  data to JupiterOne during the integration execution step that it has been
  collected in.

  See PR [#396](https://github.com/JupiterOne/sdk/pull/396)

- OPTIMIZATION: Reduce the size of the graph object files that are stored on
  disk by default. Previously, all graph object files written to disk while
  running the integration locally and running the integration in the managed
  JupiterOne runtime, were created with whitespace. The file whitespace is now
  only created when running the integration locally via the CLI commands.

  See PR [#399](https://github.com/JupiterOne/sdk/pull/399)

### Removed

- Remove `BucketMap` as it's no longer used in the `FileSystemGraphObjectStore`.
  `BucketMap` was technically exposed externally, but should not have been used
  externally.

## 5.1.0 - 2020-12-08

### Added

- Added `registerEventHandlers` and `unregisterEventHandlers` exports from the
  runtime package. These functions will register a common set of event handlers
  that handle out-of-band errors that can be thrown in integration steps, such
  as `unhandledRejection` and `multipleResolves`. These handlers should be added
  to any deployment projects that invoke `executeIntegrationInstance`.
  Developers should instrument these event handlers as early as possible in the
  node process.
- Added `registerIntegrationLoggerEventHandlers` and
  `unregisterIntegrationLoggerEventHandlers` as convenience functions, since
  JupiterOne infrastructure will handle these event emitter failures by calling
  `logger.error()`.
- Added `registerEventHandlers` to `executeIntegrationLocally`, so that events
  are caught when running `yarn j1-integration collect`.
- Made `registerIntegrationEventHandlers` call the integration logger
  `onFailure` function.

### Changed

- Increase concurrency on integration data uploads
- Implement retry logic around integration data uploads

## 5.0.0 - 2020-11-24

### Added

- `ExecutionContext.executionHistory` is always provided to integrations
- `ExecutionHistory.current: Execution` to provide information about the current
  execution.

### Changed

- `ExecutionHistory` properties have been renamed as part of adding
  `current: Execution`, to avoid duplication in the naming: `lastExecution` ->
  `previous`, `lastSuccessfulExecution` -> `lastSuccessful`.
- BREAKING: `executeIntegrationInstance` now requires an `ExecutionHistory`
  argument containing the `current: Execution`.
- BREAKING: `executeWithContext(context: ExecutionContext, ...)` now requires
  that `ExecutionContext.executionHistory` is provided.

## 4.3.0 - 2020-11-24

### Added

- Log whether compression is enabled or not at beginning of execution

## 4.2.0 - 2020-11-21

### Added

- Specifying the `INTEGRATION_FILE_COMPRESSION_ENABLED` environment variable
  will now compress local integration graph object files with Brotli compression
  on writes and decompress on reads.

### Changed

- Stop handling `IntegrationDuplicateKeyError` as fatal. Previously, this type
  of error would terminate the integration completely and no data would be
  ingested. Now, the step that raises this error will not complete, but all
  other steps will complete and partial datasets will be processed.

- Publish integration disk size event on interval

## 4.1.0 - 2020-11-18

### Added

- `ExecutionContext.history?: ExecutionHistory` provides information about the
  `lastExecution` and `lastSuccessfulExecution`. Integrations may use this to
  limit data ingestion.
- Allow `executeIntegrationInstance` to take a custom `GraphObjectStore`
- Expose `BucketMap` and `FileSystemGraphObjectStore` from
  `@jupiterone/integration-sdk-runtime`
- Steps may declare that a type of graph object will be `partial` to indicate
  that they will never ingest a complete set of some `_type`s of
  entities/relationships.

### Changed

- Refactored some tests

## 4.0.1 - 2020-10-30

- Upgrade `@jupiterone/data-model@^0.15.0`

## 4.0.0 - 2020-10-29

### Changed

- Removed `createApiClientWithApiKey` helper from runtime package. You must use
  `createApiClient` for compatibility with new service tokens.

### Fixed

- Pass `onFailure` function to children of `IntegrationLogger`

## 3.8.0 - 2020-10-26

### Added

- Expose `onFailure` callback in `createIntegrationLogger`

## 3.7.0 - 2020-10-23

### Added

- [#362](https://github.com/JupiterOne/sdk/issues/362) - Added `onFailure`
  callback to integration logger constructor.

## 3.6.0 - 2020-10-19

### Added

- [#355](https://github.com/JupiterOne/sdk/issues/355) - Added
  `normalizeGraphObjectKey` argument to normalize lookups in
  `DuplicateKeyTracker`.
- Print link to `data-model` when `toMatchGraphObjectSchema` jest matcher fails.

## 3.5.1 - 2020-10-05

### Changed

- Update `@jupiterone/data-model`

### Fixed

- Fixed unexpected behavior in `createIntegrationEntity()` when `status`
  property is set to anything except `Online` or `Active`

## 3.5.0 - 2020-10-03

### Changed

- Updated `@jupiterone/data-model` to version 0.13.0.

## 3.4.0 - 2020-10-01

### Added

- Added `toMatchDirectRelationshipSchema` matcher.

### Changed

- Upgrade to `@jupiterone/data-model@0.12.0`
- `Entity.id` is now `string | string[]` in the `data-model` (see
  [PR](https://github.com/JupiterOne/data-model/pull/44)). Integrations may
  enrich existing entities through mapped relationship `targetEntity.id` values.

## 3.3.0 - 2020-09-25

### Added

- `j1-integration visualize-type` command generates metadata graph of types
- Added `--disable-schema-validation` flag to `j1-integration collect` command.
- Added optional `setData` input to `createMockJobState()` test util.

### Changed

- Introduced `shouldReportErrorToOperator` function for integration runtime
  environments to check whether an `Error` is of a type that need not be alerted
  to deployment operators. All `Error`s other than those only an end user can
  resolve should be reported.
- [#333](https://github.com/JupiterOne/sdk/issues/333) - Made
  `ToMatchGraphObjectSchemaParams.schema` property optional in jest matcher.
- Changed index signature of `AdditionalRelationshipProperties` to not allow
  Array or Object types.

## 3.2.0 - 2020-09-01

### Changed

- [#321](https://github.com/JupiterOne/sdk/issues/321) -
  `j1-integration document` output in alphabetical order by entity metadata
  `resourceName` property and relationship metadata `_type` property.

## 3.1.0 - 2020-08-26

### Changed

- Upgrade to `@jupiterone/data-model@0.9.0`

## 3.0.1 - 2020-08-26

### Fixed

- [#301](https://github.com/JupiterOne/sdk/issues/301) - Fix test `findEntity`
  for initialized entities in a `MockJobState`.

## 3.0.0 - 2020-08-24

### Added

- [#291](https://github.com/JupiterOne/sdk/issues/291) - Introduce
  `j1-integration document` command that is used to automatically generate
  documentation in `{integration-proj-dir}/docs/jupiterone.md`.

- [#284](https://github.com/JupiterOne/sdk/issues/284) - Introduce
  `jobState.findEntity`, which will return `null` if the entity does not exist.

Example:

```typescript
const entity = await jobState.findEntity('entity-key-here');
```

- [#303](https://github.com/JupiterOne/sdk/issues/303) Export
  `RelationshipClass` from the `@jupiterone/data-model` inside of
  `@jupiterone/integration-sdk-core`.

Usage:

```typescript
import { RelationshipClass } from '@jupiterone/integration-sdk-core';
```

### Changed

- **BREAKING** [#291](https://github.com/JupiterOne/sdk/issues/291) - Remove
  `types` from `IntegrationStep` in favor of `entities` and `relationships`,
  which contain metadata used to generate documentation.

- **BREAKING** [#285](https://github.com/JupiterOne/sdk/issues/285) - Require a
  `RelationshipClass` from `@jupiterone/data-model` to be specified in
  relationship creation functions.

Example:

```typescript
import {
  createDirectRelationship,
  RelationshipClass
} from '@jupiterone/integration-sdk-core';

createDirectRelationship({
  _class: RelationshipClass.HAS,
  ...
});
```

### Removed

- [#288](https://github.com/JupiterOne/sdk/issues/299) - Remove deprecated
  `createIntegrationRelationship` function

- [#306](https://github.com/JupiterOne/sdk/issues/306) - Remove
  `jobState.getEntity` in favor of `jobState.findEntity`

## 2.11.1 - 2020-08-21

### Fixed

- [#293](https://github.com/JupiterOne/sdk/issues/293)
  `toMatchGraphObjectSchema` generates an invalid JSON schema when using
  `_class` with duplicate `required` or `types` properties.

## 2.11.0 - 2020-08-20

### Changed

- Updated `@jupiterone/data-model` to latest version (`0.8.1`).

## 2.10.1 - 2020-08-18

### Removed

- #288 - Remove `sourceEntityType` from `RelationshipMapping` interface

### 2.10.0 - 2020-08-06

### Changed

- #279 - Update `.eslintrc` to include eslint rules that will help catch async
  errors

- Updated root `.eslintrc` to use
  `@jupiterone/integration-sdk-dev-tools/config/eslint.json` directly with
  specific overrides.

### Fixed

- `jobState.addRelationships` floating promise in
  `@jupiterone/integration-sdk-testing`
- Various async fixes in test suites

## 2.9.2 - 2020-08-06

### Fixed

- Test instance of `jobState.getEntity()` threw error saying entity not found
  even though it was added to the job state.

## 2.9.1 - 2020-08-06

### Fixed

- Install direct `deepmerge` dependency into
  `@jupiterone/integration-sdk-testing` package.

## 2.9.0 - 2020-08-05

### Updated

- #270 - Return the Entity from `jobState.addEntity` and `jobState.addEntities`

Example:

```typescript
const entity = await jobState.addEntity(convertToEntity(data));
const entity2 = await jobState.addEntity(convertToOtherEntity(entity2));
await jobState.addRelationship(
  convertToRelationship(entity, entity2)
);

// Or this:
await jobState.addRelationship(
  convertToRelationship(
    await jobState.addEntity(convertToEntity(data))
    await jobState.addEntity(convertToOtherEntity(entity2))
  )
);
```

### Fixed

- Fixed `visualize` cmd where mapped relationships did not consider
  `targetFilterKey` when matching entities
- Fixed `visualize` cmd where multiple nodes with the same nodeId could be
  created, which causes rendering to fail

## 2.8.0 - 2020-08-3

### Added

- Automatically register custom Jest test matchers when using
  `@jupiterone/integration-sdk-dev-tools`. See:
  https://github.com/JupiterOne/sdk/issues/265

## 2.7.0 - 2020-08-2

### Added

- Added Jest test matcher for validating collected entities against a JSON
  schema. See: https://github.com/JupiterOne/sdk/issues/263

Example:

```typescript
expect(context.jobState.collectedEntities).toMatchGraphObjectSchema({
  _class: ['Service'],
  schema: {
    additionalProperties: false,
    properties: {
      _type: { const: 'google_cloud_api_service' },
      category: { const: ['infrastructure'] },
      state: {
        type: 'string',
        enum: ['STATE_UNSPECIFIED', 'DISABLED', 'ENABLED'],
      },
      enabled: { type: 'boolean' },
      usageRequirements: {
        type: 'array',
        items: { type: 'string' },
      },
      _rawData: {
        type: 'array',
        items: { type: 'object' },
      }
   }
});
```

## 2.6.0 - 2020-07-28

### Added

- Added `getEntity({ _type, _key })` function
- Added optional `sourceEntityType` property on `RelationshipMapping`

### Changed

- Deprecated `createIntegrationRelationship`. Developers should use the exported
  `createDirectRelationship` or `createMappedRelationship` functions.

## 2.5.0 - 2020-07-28

### Added

- `j1-integration visualize` added mapped relationships as dashed lines.

### Changed

- `j1-integration visualize` entities are colored by `_type`.
- Updated `IntegrationConfig` to support asynchronous `getStepStartStates`. See
  [#254](https://github.com/JupiterOne/sdk/issues/254) for more information.

Example:

```typescript
export const invocationConfig: IntegrationInvocationConfig<IntegrationConfig> = {
  async getStepStartStates(ctx) {
    return {
      'fetch-users': { disabled: await checkFetchUsersStepDisabled(ctx) }
    };
  },
  ...
};
```

## 2.4.0 - 2020-07-22

### Added

- Disk usage metrics are now published by the logger.

## 2.3.0 - 2020-07-06

### Changed

- Updated `@jupiterone/data-model` to latest version (`0.7.1`).

### Fixed

- `@jupiterone/integration-sdk-dev-tools` did not include `ts-node`, so that
  `yarn start` would fail to execute with 'Integration invocation configuration
  not found. Configuration should be exported as "invocationConfig" from
  "src/index".'

## 2.2.0 - 2020-06-23

### Changed

- `publishMetric` now logs the metric that is published.

## 2.1.1 - 2020-06-23

### Changed

- The `validateInvocation` function will have certain types of errors it throws
  (`IntegrationValidationError`, `IntegrationProviderAuthenticationError`)
  logged at `level: 40` (warn) instead of `level: 50` (error). These are types
  that are considered handled user errors and are expected to be communicated to
  the user in a way that allows them to address the problem. All other error
  types thrown from the function will continue to be logged at `level: 50`.

## 2.1.0 - 2020-06-19

### Changed

- Replace `createMockIntegrationLogger` implementation with a silent version of
  the logger exposed by `@jupiterone/integration-sdk-runtime`.

## 2.0.0 - 2020-06-17

### Changed

- Decoupled synchronization event publishing from the `IntegrationLogger`. Event
  publishing can now be performed by listening to events that the logger
  publishes.

### Removed

- Remove the need for the `JUPITERONE_DISABLE_EVENT_LOGGING` environment
  variable.
- Removed `ApiClient` type from the `@jupiterone/integration-sdk-core` package.
  Also removed the dependency on `axios` from the package as well.
- Removed `registerSynchronizationContext` function from the `IntegrationLogger`

### Added

- `convertProperties` supports an option `parseTime`, directing the function to
  convert properties that are named with common suffixes (on, at, time, date) to
  a UNIX timestamp (number).
- Added `publishMetric` function to `IntegrationLogger` that now causes a
  `metric` event to be emit.

## 1.1.1 - 2020-06-08

### Added

- Allow extended types of Relationships/Entities to be iterated over with
  `iterateEntities` and `iterateRelationships` on `JobState`

## 1.1.0 - 2020-06-04

### Added

- Added the `@jupiterone/integration-sdk-dev-tools` package which contains some
  shared development dependencies and configuration files.

### Fixed

- `createIntegrationRelationship` made `_key` optional for relationship
  mappings, a fine thing to do because specifying the `_key` for those insn't
  necessary. However, the function was changed at the same time to stop
  generating a `_key`, which is required to ensure the collected relationships
  are unique. This fixes things so the `_key` remains an optional argument, and
  improves the generation of the `_key` to ensure better uniqueness.

## 1.0.2 - 2020-06-04

### Fixed

- Regression: `createIntegrationRelationship()` lost a change to accept optional
  `_type` for relationship mappings, overriding the generated value or values
  provided in `properties` option.
- Removed `@types/vis` from dependencies to devDependencies because having the
  type forces typescript consumers to have `DOM` in the their `lib` compiler
  option.

## 1.0.1 - 2020-06-03

### Fixed

- Make published packages leaner by only including `dist` files.

## 1.0.0 - 2020-06-03

### Fixed

- `createIntegrationRelationship` for a mapped relationship would attempt to
  generate a `_key` value when none was provided. This is not useful for a
  mapped relationship since these are not actually a relationship, but a
  directive to the mapper to produce one or more relationships, each of which
  would not have the provided/generated `_key`.

### Removed

- Removed the deprecated convention based invocation config loading.

### Changed

- `convertProperties` would transfer an Array such as `[ null ]`. Now an Array
  where the first entry is an object is not transferred unless
  `stringifyArray: true`, or `stringifyObjects: true` (the property will be an
  array full of JSON strings), and where the first value is `null` or
  `undefined`, the property is not transferred at all.
- Related to the removal of convention based configuration loading, the
  `createMockExecutionContext` and `createMockStepExecutionContext` utilities
  exposed by `@jupiterone/integration-sdk-testing` now require
  `instanceConfigFields` to be passed in for config value generation to work.

### Changed

- Upgrade to `@jupiterone/data-model@0.6.4`

## Pre 1.0.0

Prior to the `1.0.0` release, all integration SDK functionality was exposed by
the `@jupiterone/integration-sdk` package. That package has now been split up
into the following packages:

- `@jupiterone/integration-sdk-core`
- `@jupiterone/integration-sdk-runtime`
- `@jupiterone/integration-sdk-testing`
- `@jupiterone/integration-sdk-cli`

To view the changes that went into `@jupiterone/integration-sdk`, please see
[LEGACY_SDK_CHANGELOG.md](./LEGACY_SDK_CHANGELOG.md).
