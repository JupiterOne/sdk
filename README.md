# @jupiterone/sdk

This repository contains a collection of packages that can be used to develop
against JupiterOne.

## Integration Development

Please reference the
[development documentation](docs/integrations/development.md) for details about
how to develop integrations with this SDK.

## Integration SDK Development

If you are making changes to the integration SDK and you want to test the
changes in another integration project then it is recommended to automatically
rebuild and link this project when changes are made.

Steps to automatically build and link:

- Run `yarn type-check --watch` in _this_ project from a terminal and wait for
  initial build to complete.

- Run `yarn link` in the package that you want to link.

- In a separate terminal, run `yarn link @jupiterone/<package>` in the
  integration project. You can now use the integration SDK CLI in the other
  project and it will use the latest code on your filesystem.
