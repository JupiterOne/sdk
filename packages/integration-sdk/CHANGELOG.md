# Changelog

All notable changes to the `@jupiterone/integration-sdk-*` projects will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Added `getEntity({ _type, _key })` function
- `j1-integration visualize`:
  - Nodes (entities) are colored by `_type`.
  - Mapped relationships are shown as dashed lines (edges)

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
