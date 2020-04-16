# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Exposed `createMockExecutionContext` function from
  `@jupiterone/integration-sdk/testing` to assist with unit testing the
  `validateInvocation` and `getStepStartState` functions.

## 0.2.2 - 2020-04-15

### Changed

- Fix windows compatibility issues

## 0.2.1 - 2020-04-14

### Changed

- Change `publishConfig` to make package public.

## 0.2.0 - 2020-04-14

### Added

- Executing an integration will now perform removal of `.j1-integration` prior
  to collecting data.
- Environment variable config loader now utilizes `dotenv` to automatically read
  `.env` file for variables.
- Logging for step completion and failures.

### Changed

- `ts-node` is no longer an explicit dependency of the project. Detection of
  TypeScript files is now performed prior to registering `ts-node`.

## 0.1.0 - 2020-04-13

### Added

- Step dependency graph creation and execution.
- Automatic `instanceConfigField` loading based on environment variable
- `validateInvocation` hook handling.
- `getStepStartState` hook for disabling steps.
- `jobState` helper object for writing collected entities and relationships.
- `createIntegrationEntity` and `createIntegrationRelationship` utilities from
  managed sdk.
- `converters`, `tagging`, and `ip` utilities from managed sdk.
- `collect` CLI command for executing integration data collection
- `logger` utility on context objects.
- Loading of configuration based on project structure.
- Loading of TypeScript project files via `ts-node`.
