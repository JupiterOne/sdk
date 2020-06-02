# @jupiterone/sdk

This repository contains a collection of packages that can be used to develop
against JupiterOne.

## Development

First install dependencies using `yarn`.

This project utilizes TypeScript project references for incremental builds. To
prepare all of the packages, run `yarn build`. If you are making a changes
across multiple packages, it is recommended you run `yarn build --watch` to
automatically compile changes as you work.

### Linking packages

If you are making changes to the SDK and you want to test the changes in another
project then it is recommended to automatically rebuild and link this project
when changes are made.

Steps to automatically build and link:

- Run `yarn build` or `yarn build --watch` in _this_ project from a terminal and
  wait for initial build to complete.

- Run `yarn link` in the package that you want to link.

- In a separate terminal, run `yarn link @jupiterone/<package to link>` in the
  integration project. You can now use the integration SDK CLI in the other
  project and it will use the latest code on your filesystem.

## Integration Development

Please reference the
[development documentation](docs/integrations/development.md) for details about
how to develop integrations with this SDK.
