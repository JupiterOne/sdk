# Changelog

All notable changes to the `@jupiterone/integration-sdk-*` projects will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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
getData: <T>(key: string) => Promise<T>;
```

New:

```ts
getData: <T>(key: string) => Promise<T | undefined>;
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
