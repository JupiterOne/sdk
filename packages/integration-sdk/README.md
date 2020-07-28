# @jupiterone/integration-sdk

Note: This package has been been deprecated and should no longer be used.

The functionality provided by this package has been broken up into multiple
smaller packages.

This is now a shell package used to store historical information about the older
`@jupiterone/integration-sdk` and also track changes made to the
`@jupiterone/integration-sdk-*` family of packages.

If you are developing an integration, use the `@jupiterone/integration-sdk-core`
and `@jupiterone/integration-sdk-cli` packages.

## Versioning this project

To version all packages in this project and tag the repo with a new version number, run the following (where `major.minor.patch` is the version you expect to move to):

```shell
git checkout -b release-<major>.<minor>.<patch>
git push -u origin release-<major>.<minor>.<patch>
yarn lerna version {major, minor, patch}
```

Note the `git checkout`/`git push` is required because Lerna will expect that you've already created a remote branch before bumping, tagging, and pushing the local changes to remote.
