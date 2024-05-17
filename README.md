# @jupiterone/sdk

A collection of packages supporting integrations with JupiterOne.

## Development Resources

- [Getting Started With Integration Development](docs/integrations/development_guide.md)
- [SDK and CLI Reference](docs/integrations/development.md)
- [Common Step Patterns](docs/integrations/step-patterns.md)
- [Testing Integrations](docs/integrations/testing.md)

## Introduction

Integrating with JupiterOne may take one of these paths:

1. A structured integration leveraging **this SDK** to dramatically simplify the
   synchronization process, essential for any significant, ongoing integration
   effort
1. A command line script (sh, bash, zsh, etc.) using the [JupiterOne CLI
   tool][2] to easily query/create/update/delete entities and relationships in
   bulk
1. Any programming/scripting language making HTTP GraphQL requests to
   [query/create/update/delete entities and relationships][1]
1. A JavaScript program using the [JupiterOne Node.js client library][2] to
   query/create/update/delete entities and relationships

The integration SDK structures an integration as a collection of simple, atomic
steps, executed in a particular order. It submits generated entities and
relationships, along with the raw data from the provider used to build the
entities, to the JupiterOne synchronization system, which offloads complex graph
update operations, provides integration progress information, and isolates
failures to allow for as much ingestion as possible.

An integration built this way runs not only on your local machine; it can be
deployed to JupiterOne's managed infrastructure. You can easily build the
integration you need today and run it wherever you'd like. When you're ready, we
can help you get that integration running within the JupiterOne infrastructure,
lowering your operational costs and simplifying adoption of your integration
within the security community!

Please reference the
[integration development documentation](docs/integrations/development.md) for
details about how to develop integrations with this SDK.

## Development

To get started with development:

1. Install dependencies using `npm install`
1. Run `npm run build`

This project utilizes TypeScript project references for incremental builds. To
prepare all of the packages, run `npm run build`. If you are making a changes
across multiple packages, it is recommended you run `npm run build -- --watch`
to automatically compile changes as you work.

### Linking packages

If you are making changes to the SDK and you want to test the changes in another
project then it is recommended to automatically rebuild and link this project
when changes are made.

Steps to automatically build and link:

- Run `npm run build` or `npm run build --watch` in _this_ project from a
  terminal and wait for initial build to complete.

- Run `npm link` in the package that you want to link.

- In a separate terminal, run `npm link @jupiterone/<package to link>` in the
  integration project. You can now use the integration SDK CLI in the other
  project and it will use the latest code on your filesystem.

### Versioning this project

To version all packages in this project and tag the repo with a new version
number, run the following (where `major.minor.patch` is the version you expect
to move to). Don't forget to update the `CHANGELOG.md` file!

```shell
git checkout -b release-<major>.<minor>.<patch>
git push -u origin release-<major>.<minor>.<patch>
npm exec lerna version <major>.<minor>.<patch>
```

Note the `git checkout`/`git push` is required because Lerna will expect that
you've already created a remote branch before bumping, tagging, and pushing the
local changes to remote.

❕Make sure to have committed all your changes before running
`npm exec lerna version` since it will commit the version update and tag that
commit. Rebasing or amending lerna's commit will cause the tag to point to a
different commit.

[1]:
  https://support.jupiterone.io/hc/en-us/articles/360022722094-JupiterOne-Platform-API
[2]: https://github.com/JupiterOne/jupiterone-client-nodejs
