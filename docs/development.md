# Integration development

This project exposes both a module exposing a framework for constructing
integrations and also a CLI to assist with collecting and publishing data with
JupiterOne.

For the purpose of synchronizing data, developers only need to collect the "new
state of the world" from a provider and have the data sent to JupiterOne. Data
that was sent up will be diffed against JupiterOne's understanding of the
"world" and persisted via a background process.

## The integration framework

This SDK exposes an opinionated interface for developing integrations with
either JavaScript or TypeScript.

It is expected that an integration exposes an `.js` or `.ts` file that contains
an object that defines required configuration fields needed to run the
integration, a function for performing config field validation, a function for
determining which phases and steps of an integration should be ignored, and a
list of phases that define how an integration should collect data. It is
expected that the integration configuration file exposes an `invocationConfig`
from the module.

This could be done a variety of ways:

With JavaScript:

```js
exports.invocationConfig = config;

// or

module.exports = {
  invocationConfig: config,
};
```

With TypeScript:

```
export const invocationConfig = config;
```

Here is an example of an integration configuration:

```ts
export const invocationConfig: IntegrationInvocationConfig = {
  instanceConfigFields: {
    clientId: {
      type: 'string',
      mask: false,
    },
    clientSecret: {
      type: 'string',
      mask: true,
    },
    ingestGroups: {
      type: boolean,
      mask: true,
    },
  },

  invocationValidator (context: IntegrationExecutionContext) {
    const { config } = context.instance;

    if (!config.clientId || !config.clientSecret) {
      throw new IntegrationInstanceConfigError(
        "Config requires a clientId and clientSecret to be provided",
      );
    }

    return validate(config);
  },

  getStepStartStates(
    executionContext: IntegrationExecutionContext,
  ) IntegrationStepStartStates {
    const { config } = executionContext.instance

    const notDisabled = { disabled: false };
    const shouldIngestGroups = config.ingestGroups;

    return {
      'fetch-accounts': notDisabled,
      'fetch-users': notDisabled,
      'fetch-groups': { disabled: !config.ingestGroups },
    }
  },

  integrationStepPhases: [
    {
      id: 'phase-account',
      name: 'Collect accounts',
      types: ['my_integration_account'],
      steps: [
        {
          id: 'step-fetch-accounts',
          name: 'Fetch Accounts',
          async executionHandler (
            executionContext: IntegrationStepExecutionContext,
          ) {
            return fetchAccounts(executionContext);
          },
        },
      ],
    },
    {
      id: 'phase-users-and-groups',
      name: 'Collect users and groups',
      steps: [
        {
          id: 'step-fetch-users',
          name: 'Fetch Users',
          types: ['my_integration_user'],
          async executionHandler (
            executionContext: IntegrationStepExecutionContext,
          ) {
            return fetchUsers(executionContext);
          },
        },
        {
          id: 'step-fetch-groups',
          name: 'Fetch Groups',
          types: ['my_integration_group'],
          executionHandler (
            executionContext: IntegrationStepExecutionContext,
          ) {
            return fetchGroups(executionContext);
          },
        },
      ],
    },
    {
      id: 'phase-build-relationships',
      name: 'Collect accounts',
      steps: [
        {
          id: 'step-build-user-to-group-relationships',
          name: 'Fetch Accounts',
          types: ['my_integration_user_to_group_relationship'],
          dependsOn: ['step-fetch-users', 'step-fetch-groups'], // alternatively ['phase-users-and-groups']
          async executionHandler (
            executionContext: IntegrationStepExecutionContext,
          ) {
            return fetchAccounts(executionContext);
          },
        },
      ],
    },

  ],
};
```

### `IntegrationInvocationConfig` fields

#### `instanceConfigFields`

The `instanceConfigFields` field contains a map of integration fields that are
required to be provided for authenticating with a given provider API. This
varies between services.

#### `invocationValidator`

The `invocationValidator` field is a validation function that is required for
ensuring the integration has received a valid set of `instanceConfigFields`. It
is common practice to execute a test API call to ensure everything has been
configured properly.

#### `getStepStartStates`

The `getStepStartStates` is an optional function that can be provided for
determining if a certain phase or step should be run or not.

#### `integrationStepPhases`

The `integrationStepPhases` field is used to define how an integration collects
data. It is expected that an array of phases that contain "steps" to perform the
collection of data needs to be passed in. Phases are run in sequence and steps
are run in parallel. This allows for data from a previous phase to be referenced
in a later stage.

A `phase` must contain an `id`, `name`, and array of `steps` to perform.

A `step` must contain an `id`, `name`, list of `types` that the step expects to
generate and an `executionHandler` function that performs the data collection
work. It is important to provide `types` because that data will be used to
provide context for the backend synchronization process and determine how
updates and deletes should be applied.

Optionally, a `step` can contain a `dependsOn` list that references previous
phases and steps. This field will be used to determine if previous work has
failed to complete and if the synchronization process should treat the data
retrieved in the step as a partial dataset. See the [Failure handling](#Failure
handling) section below for more information.

### How integrations are executed

The `IntegrationInvocationConfig` declaratively defines how an integration runs.
The CLI that is provided by this package will consume the invocation
configuration and construct a state machine to execute work in a specific order.

The `invocationValidator` function will run first to ensure the integration is
capable of interfacing with a given provider. Next, the `getStepStartStates`
will run to get a list of integration phases and steps that should be executed.
Finally, the phases in `integrationStepPhases` are then executed in sequence.

### What's in the `IntegrationExecutionContext` and `IntegrationExecutionStepContext`?

#### `IntegrationExecutionContext`

The `IntegrationExecutionContext` contains some basic utilities to provide some
information about the entity data.

##### `instance`

An `instance` field containing the integration
instance, which contains configuration field values stored under a `config`
field. When only performing local data collection, this is mocked out.

##### `logger`

It includes a `logger` that can be used by the integration developer
for debugging their integration. This follows a similar api to other Node.js
loggers such as [bunyan](https://github.com/trentm/node-bunyan) or
[pino](https://github.com/pinojs/pino), providing a standard set of log levels
(`debug`, `trace`, `info`, `warn`, and `error`)
and also allowing for child loggers to be created via the `child` function.

Messages logged via the `logger` are not displayed to customers via the
integration job event log.

##### `jobLog`

A `jobLog` utility will also be provided for reporting events to the JupiterOne
integration events job log. This can be used for displaying information about
an integration's progress.

A limited interface be available for developers using the api display
special messages to consumers. This interface may expand in the future
as the need for different message types arise.

###### `forbiddenResource`

The `forbiddenResource` function will be exposed to allow developers to
display warnings that the integration's access to a given resource is
not allowed. This message helps integration consumers understand
that the configuration they have provided has insufficient permissions
and if they want to resolve this, changes need to be made.

#### `IntegrationExecutionStepContext`

The `IntegrationExecutionStepContext` contains the same data stored in the
`IntegrationExecutionContext` but also contains a `jobState` object that
provides utilities for collecting and validating graph data.

##### `jobState`

The `jobState` object is used for collecting entities and relationships
that have been created throughout the integration run via the
`addEntities` and `addRelationships` functions.

Previously collected integration data can be collected via
the `iterateEntities` and `iterateRelationships` function.
These functions will initially allow for data to be fetched via the `_type`
property, but in the future will allow provide more options for collecting.

Example usage:

```ts
await iterateEntities({_type: 'my_integration_user'}, async (userEntity) => {
  await doWorkWithEntity(userEntity);
});
```

More details about how the framework uses `jobState` is detailed in
the [Data collection](# Data collection) section below.

### Additional utilities

#### Graph model validation

To assist with keeping data consistent with our graph data model, the
integration SDK will expose utility functions (`createIntegrationEntity` and
`createIntegrationRelationship`) for validating entities and relationships based
on their assigned `_class`.

These functions will automatically validate that an entity contains required
fields.

#### Raw data collection

In addition to performing validation, the `createIntegrationEntity` and
`createIntegrationRelationship` will also automatically encode and store the
original provider data under a `__rawData` field. For now, this will always
assume that data coming in was stored as `json`, but support for other data
types will come later.

### Auto-magic behind the framework

#### Event reporting

When running an integration, debug information will automatically be logged
to `stdout` about the `phase` and `step` being run.
This allows for developers to keep track of how the integration is progressing
without the need to explicitly add logging information themselves.

When the integration is run with context about an integration instance
(via the `run` command exposed by the [The CLI](# The CLI)), the transitions
between each `phase` and `step` are also published to
JupiterOne via the `jobLog` utility.

#### Data collection

The `executionContext` that is provided in the `executionHandler` step exposes a
`jobState` utility that can be used to collect entity and relationship data via
`addEntities` and `addRelationships` functions. The `jobState` utility will
automatically flush the data to disk as a certain threshold of entities and
relationships is met. The data flushed to disk are grouped in folders that based
on the phase and step that was run. Entities and relationships will also be grouped
by the `_type` and linked into separate directories to provide faster look ups.
These directories will be used by the `iterateEntities` and `iterateRelationships`
functions to provide faster lookups.

From our experience, integrations most
commonly query collected data from previous phases via the `_type` property for
constructing relationships, so the integration framework currently optimizes for
this case. In the future, we plan to allow data to be indexed in different ways
to assist with optimizing different approaches constructing entities and
relationships. It is worth noting that the method in which data is
indexed can change in the future.

Using the integration configuration that was provided as a sample earlier, data
will be written to disk in the following structure (relative to the
integration's current working directory).

To assist with debugging and visibilty into exactly what data was collected, the
integration will bucket data collected from each phase and step. Here is
an example of what the `.j1-integration` directory may look like.

```
.j1-integration/
  /index/
    /entities/
      _type
        my_integration_account/
          11fa25fb-dfbf-43b8-a6e1-017ad369fe98.json
        my_integration_group/
          f983f07d-f7d8-4f8e-87da-743940a5f48d.json
          a76695f8-7d84-411e-a4e1-c012de041034.json
        my_integration_user/
          9cb7bee4-c037-4041-83b7-d532488f26a3.json
          96992893-898d-4cda-8129-4695b0323642.json
    /relationships
      _type/
        my_integration_user_to_group_relationship/
          8fcc6865-817d-4952-ac53-8248b357b5d8.json
  /graph
    /00-phase-accounts
      /00-step-fetch-accounts
        /entities/
          11fa25fb-dfbf-43b8-a6e1-017ad369fe98.json
        /relationships
    /01-phase-users-and-groups
      /00-step-fetch-users
        /entities
          9cb7bee4-c037-4041-83b7-d532488f26a3.json
          96992893-898d-4cda-8129-4695b0323642.json
        /relationships
      /01-step-fetch-groups
        /entities
          a76695f8-7d84-411e-a4e1-c012de041034.json
          f983f07d-f7d8-4f8e-87da-743940a5f48d.json
        /relationships
    /02-phase-build-relationships
        /relationships
          8fcc6865-817d-4952-ac53-8248b357b5d8.json
```

Integration data that is staged for publishing will be stored under the
`.j1-integration/graph` directory. Files containing Entities will be suffixed
with `.entities.json` and files containing Relationships will be suffixed with
`.relationships.json`. This is done because the directory structure of the
`graph` directory is meant to assist with debugging and provide developrs
insight about the data collect in each phase. During synchronization, the
directory will be blind

Data will be indexed by `_type` and stored under the
`.j1-integration/index/_type` directory.

Each `json` file will store data under the following format (describe with a
typescript interface):

```
interface FlushedEntityGraphData {
  entities: Entity[]
}

interface FlushedRelationshipGraphData {
  relationships: Relationship[]
}
```

It's best to keep a "collect and forget" mindset to avoid retaining too much
collected data in memory. Flushed data can always be pulled back into memory
later via the `listEntitiesByType` and `listRelationshipsByType` and reading
data from disk is decently fast.

#### Failure handling

By default, the framework will only halt the execution of an integration if the
configuration validation fails. Failures that occur during the execution of a
phase or step will not halt the execution of later phases. Information on which
steps and phases that have failed will be collected and published as metadata
when performing synchronization with JupiterOne. A failure in a step or phase
will automatically be logged along with context about the error that occurred.
At the end of an integration run, a summary will be displayed of the overall
status to give developers a good idea of how failures will have affected the
JupiterOne graph.

An example summary of the phases and steps will like this:

```json
[
  {
    "id": "phase-account",
    "name": "Collect accounts",
    "status": "success"
  },
  {
    "id": "phase-users-and-groups",
    "name": "Collect users and groups",
    "status": "partial_failure",
    "steps": [
      {
        "id": "step-fetch-users",
        "name": "Fetch Users",
        "types": ["my_integration_user"],
        "status": "failure"
      },
      {
        "id": "step-fetch-groups",
        "name": "Fetch Groups",
        "types": ["my_integration_group"],
        "status": "success"
      }
    ]
  },
  {
    "id": "phase-build-relationship",
    "name": "Collect accounts",
    "status": "partial_success",
    "steps": [
      {
        "id": "step-build-user-to-group-relationships",
        "name": "Fetch Accounts",
        "types": ["my_integration_user_to_group_relationship"],
        "dependsOn": ["step-fetch-users", "step-fetch-groups"],
        "status": "partial_success_from_dependency_failure"
      }
    ]
  }
]
```

Options for pretty printing this data in a more concise format may come in the
future.

##### Phase and step status codes

For steps:
`success` - the step has successfully completed without any errors occurring
`failure` - an error has occurred and it is possible that we have a partial dataset
`partial_success_from_dependency_failure` - the step has successfully completed but
a dependent step was found in the `failure` or `partial_success_from_dependency_failure`,
meaning it is possible that a failure has happened.

For phases:
`success` - all of the steps within the phase has successfully completed
`failure` - all of the steps within the phase have failed to complete
`partial_success` - all of the steps have completed but one or more
steps have returned a `partial_success_from_dependency_failure`
`partial_failure` - one or more steps have failed

#### Letting the synchronizer know about partial datasets

The framework's state machine will utilize the `types` and `dependsOn` fields
for constructing a list of entity and relationship types that should be
considered a partial dataset. The backend synchronization process that performs
the diffing of the data will receive a list of types that have been affected by
a failure to help determine how updates should be applied and what data is safe
to delete. The information about partial datasets will be sent when starting the
synchronization process to prevent data that should be retained in the graph
from being removed.

After the collection phase, the integration summary and partial datasets
metadata will be written to disk in the `.j1-integration/summary.json` file.

Here is an example of what the summary file would look like.

```
{
  "integrationStepPhasesResult": [
    {
      id: "phase-account",
      name: "Collect accounts",
      status: "success"
    },
    {
      id: "phase-users-and-groups",
      name: "Collect users and groups",
      status: "partial_failure",
      steps: [
        {
          id: "step-fetch-users",
          name: "Fetch Users",
          types: ["my_integration_user"],
          status: "failure",
        },
        {
          id: "step-fetch-groups",
          name: "Fetch Groups",
          types: ["my_integration_group"],
          status: "success",
        },
      ],
    },
    {
      id: "phase-build-relationships",
      name: "Collect accounts",
      status: "partial_success",
      steps: [
        {
          id: "step-build-user-to-group-relationships",
          name: "Fetch Accounts",
          types: ["my_integration_user_to_group_relationship"],
          dependsOn: ["step-fetch-users", "step-fetch-groups"],
          status: "partial_success_from_dependency_failure",
        },
      ],
    },
  ],
  "metadata": {
    "partialDatasets": {
      "types": [
        "my_integration_user",
        "my_integration_user_to_group_relationship"
      ],
    },
  }
}
```

The `integrationStepPhasesResult` is made available for developers to understand
the status of each phase after collection has been completed.

The `metadata` contains a `partialDatasets` field that is a reduced collection
of `types` from steps that have returned with a `failure` or
`partial_success_from_dependency_failure` status.

The `metadata` field will be sent to JupiterOne upon performing the
`synchronization`.

## The CLI

To assist developers working with the integration framework, a `j1-integration`
CLI tool will also be exposed by this project.

### Supported commands

Initially, the CLI will support a limited interface consisting of only three
commands: `collect`, `sync`, and `run`.

#### `j1-integration collect`

`j1-integration collect` will run the js framework locally to _only_ perform
data collection. The `collect` command is designed to work closely with the
JupiterOne integration framework.

The `collect` command will look for an integration configuration from files in
the following order relative to the current working directory:

0. `index.js`
1. `index.ts`
2. `src/index.js`
3. `src/index.ts`

Data will be written to disk under a generated `.j1-integration` directory
(described in [this section](### Data collection). A JupiterOne API key or set
of credentials do not have to be supplied since the JupiterOne synchronization
API will not be hit. An exception to this is when the `--instance` option is
provided. (see `Options` below).

To assist with making the integrations easier to develop, a mock integration
instance will be provided with fake values.

An integration cannot run without actual data from a provider though, so CLI
will use the [dotenv](https://github.com/motdotla/dotenv) package to
automatically load and populate config values for what was supplied in the
`instanceConfigFields`.

An example `.env` file for the example integration configuration defined [in one
of the earlier sections](#The integration framework) would look like this:

```bash
CLIENT_ID="<insert provider client id here>"
CLIENT_SECRET="<insert provider client secret here>"
INGEST_GROUPS="<true or false>"
```

The snake cased environment variables will automatically be converted and
applied to the camel cased configuration field. So for example, `CLIENT_ID` will
apply to the `clientId` config field, `CLIENT_SECRET` will apply to
`clientSecret`, and `MY_SUPER_SECRET_CONFIGURATION_VALUE` will apply to a
`mySuperSecretConfigurationValue` configuration field.

This command will display the expected environment variables that should be set
prior to performing validation to provide developers feedback about what the
integration expects to see set.

##### Options

###### `--module` or `-m`

If you prefer to not to place your integration configuration in one of the
supported file paths, you can optionally specify the `--module` or `-m` option
and provide a path to your integration file.

ex: `j1-integration collect --module path/to/my/integration.ts`

###### `--instance` or `-i`

If you are working with an existing integration instance and would prefer to
leverage the configuration field values from that be used, you can optionally
supply an instance id. The CLI will leverage the values stored on the
integration instance instead of locally defined environment variables.

By default, when an `--instance` is specified, a developer will be prompted to
input some credentials.

ex: `j1-integration collect --instance <integration instance id>`

###### `--api-key` or `-k`

For developers that have an API key or prefer to not input credentials, an
`--api-key` option can be specified to access the synchronization API.

ex:
`j1-integration collect --instance <integration instance id> --api-key <my api key>`

#### `j1-integration sync`

The `sync` command will validate data placed in the `.j1-integration/graph`
directory has been formatted correctly and later format the data to allow for
data to be uploaded to JupiterOne for synchronization. Since the `sync` command
does interact with the JupiterOne synchronization API, the developer will need
to provide either credentials or an API key.

After validation is performed, `sync` will provision an integration job via a
`POST` to
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs` which
will be used for scoping integration data that is uploaded for synchronization.

Entity data will be published to
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs/:jobId/entities`.

Relationship data will be published to
`https://api.us.jupiterone.io//synchronization/:integrationInstanceId/jobs/:jobId/relationships`.

After all of the data under the `.j1-integration/graph` directory has been
published, the CLI will `POST` to
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs/:jobId/finalize`
with `metadata` that was stored in `.j1-integration/summary.json`.

This will signal JupiterOne that it is time to synchronize the published data
with the graph.

After this point, by default the CLI will end and log out a URL that can be used
to track the job status.
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/job/:jobId`

Optionally, developers can specify the `--tail` flag to automatically poll the
integration job for status updates. The polling will end once the job has been
marked as completed and metadata about the synchronization status will be
returned.

##### Keeping the door open for developers not using JavaScript or TypeScript

Not everyone uses the Node.js ecosystem and we understand that. For developers
that would prefer to use a different language for building integrations, the
`sync` command does not require that a developer use the JupiterOne integration
framework at all. The `sync` command will just recursively walk the
`.j1-integration/graph` directory, search for `.json` files, validate the data
to ensure it is formatted correctly, and publish it up via the synchronization
API.

The JupiterOne data model is open source and can be used by anyone to ensure
that data conforms to our expectations. If you build custom tooling or your own
framework for developing integrations, let us know!

##### Options

###### `--module` or `-m`

Much like the `collect` command, you can optionally specify an `--module` or
`-m` option to specify the path to the integration configuration file.

###### `--instance` or `-i`

For the `sync` command, an integration instance must be specified to know which
integration instance data the collected data should be associated with.

ex:
`j1-integration sync --instance <integration instance id> --api-key <my api key>`

###### `--api-key` or `-k`

Like the `collect` command, an API key can be optionally passed in to use for
synchronization.

ex:
`j1-integration sync --instance <integration instance id> --api-key <my api key>`

###### `--tail` or `-t`

If provided this option poll the integration job to and display the status of
the job run. The polling will stop once the job was marked as complete.

ex: `j1-integration sync --instance <integration instance id> --tail`

#### `j1-integration run`

The `j1-integration run` command combines the functionality of the `collect` and
`sync` commands, essentially running the commands back to back.

The `run` command accepts the same options that the `sync` command accepts.

There are some differences when performing `run` compared to individually
running `collect` and `sync`.

Instead of using a mock integration instance for during the `collect` phase,
`run` will always pull down an actual integration instance prior to data
collection.

After initial integration validation, `run` will provision an integration job
and work performed by phases and steps will automatically be published to our
event log via the
`https://api.us.jupiterone.io/synchronization/:integrationInstanceId/jobs/:jobId/events`
API.

#### Future commands and utilties

##### More commands and options

###### `j1-integration plan`

We hope to make it easy for developers to understand how an integration collects
data and the order in which it performs work.

We hope to support a `j1-integration plan` command to display a dependency graph
of the phases, steps, and types required for a successful integration run.

###### `j1-integration sync --dry-run`

A developer may want to have a better understanding of how synchronization of
collected data may affect their JupiterOne graph. We plan to support a
`--dry-run` flag for both the `sync` and `run` commands to provide some feedback
about what kind of changes will be applied to the graph.

This dry run function will give metrics about how many creates, updates, and
deletes will be performed, categoried by the entity and relationhip `_type`
field.

###### `j1-integration visualize`

It's important for integration developers to understand what they are really
building and how users may end up using the data. We hope to provide a way of
local data that was collected from an integration and load it into a
visualization tool for viewing the data. In the future we may even open source a
version of our JupiterOne Query Language that is capable of querying data loaded
in memory to allow devs to perform validation testing and ensure that users can
ask the right questions about collected data.

###### `j1-integration generate`

A project generator might be helpful for getting new integration developers up
and running quickly. For our own integration developers, it would provide a
consistent interface and allow developers a unified interface for building
integrations. This may even go an `ember` or `angular` cli route and provide an
opinionated interface for generating new phases and steps.

##### One CLI tool for all JupiterOne development

The `j1-integration` CLI is a standalone tool designed to work just for
integration development. The CLI tool will be designed in a way that allows for
it to be added as an `integration` subcommand for the `j1` CLI (so you can run
things like `j1 integration sync` but also maybe something like `j1 query` from
a single tool). This will likely be done by forwarding commands from the core
`j1` cli to the `j1-integration` executable or by exposing the code used for
constructing the `j1-integration` CLI to the project that handles the `j1` cli.

In the future, the `j1` CLI will provide a suite of commands for interfacing
with queries, questions, rules, and various other JupiterOne features. This may
end up living under a `@jupiterone/dev-tools` project. That repo might even end
up becoming a monorepo and become a one stop shop for all JupiterOne related
development tools.

##### Better methods of authentication with JupiterOne

The current implementation of the `j1` cli requires that an API key or set of
credentials be supplied to interface with APIs. We plan to introduce a `j1 auth`
command which will accept credentials and store the refresh and access tokens
somewhere on your file system for later use with all CLI commands. For users
that would prefer to not use an API key, this would provide a more friendly
interface for running commands that require API access. We plan to support SSO
integration with this as well.

## Does JupiterOne use this SDK for managed integrations?

We plan utilize this framework and the `j1-integration run` command for all new
integrations made. For our older integrations, we plan to eventually be migrate
them over to using this SDK.

Also since we have internal access to our APIs, we have some bypasses in place
that allow for us to directly access those apis without going through our usual
gateway.

## Future work around integrations

### `external` integrations

Sometimes customers have their own data that they want to publish and don't
necessarily want JupiterOne to manage the execution of it.

We've seen customers use our Entity/Relationship mutation APIs to build their
own integrations. Part of our reason for building and open sourcing an
integration SDK is to help out those users that perform their own diffing and
graph state management.

We hope to support the concept of an `external` integration in the near future
that will work just like our regular integrations and work with our SDK. The
only difference is that you can define your own integration (the name,
description, and configuration fields) and we won't run automatically run the
integration for you on a regularly scheduled interval (although, the option to
do have us do that is certainly something we are considering!).

### Event ingestion

At the moment a few of our managed JupiterOne integrations are capable of
handling events that perform a partial ingestion of data from a provider and
immediately reflect that in the graph.

We hope to provide a good interface via this SDK for providing an interface for
handling events via this SDK and providing commands/utilities for testing events
to get an understanding of how they may affect the JupiterOne graph.
