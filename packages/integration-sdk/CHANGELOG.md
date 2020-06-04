# Changelog

All notable changes to the `@jupiterone/integration-sdk-*` projects will be
documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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
