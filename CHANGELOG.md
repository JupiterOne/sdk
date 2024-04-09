# Changelog

All notable changes to the `@jupiterone/integration-sdk-*` projects will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# Unreleased

## 12.4.0 - 2024-04-09

- http-client: add timeout handler by default

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

- Support async `beforeAddRelationship`
