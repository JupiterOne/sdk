# @jupiterone/integration-sdk-cli

This package exposes a CLI tool that assists with executing integrations
locally.

## Integration graph generator

Create a git repository for your integration graph with
`graph-(integrationName)` name and execute the following command inside it:

```
npx @jupiterone/integration-sdk-cli generate
```

You will be prompted with some questions and the graph code will be generated so
you can start development.

## Installation

```
npm install @jupiterone/integration-sdk-cli

# or

yarn add @jupiterone/integration-sdk-cli
```
