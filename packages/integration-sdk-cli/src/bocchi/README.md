# Bocchi - a JupiterOne graph project generator

Developing a graph project from scratch for a new JupiterOne integration can be
time consuming, and typically involves writing a lot of boilerplate code that is
similar across all integrations. This is where Bocchi comes in. It's purpose is
to eliminate the need to write boilerplate code, as well as standardize much of
the logic and practices our graph projects use. Moreover, Bocchi allows us to
more quickly expand JupiterOne’s integration roster without spending a ton of
resources and development time.

Bocchi is a one-time use tool to be used when creating a new graph project. To
use Bocchi, a developer provides a JSON template that contains key components of
the new integration, such as instance configuration fields, the authentication
method, and the steps the new integration should run. Bocchi will interpret this
JSON template and generate a fully-functioning graph project - things like an
http-service client, step handlers, authentication functions, etc. will all be
written for the developer. After using Bocchi to generate a new graph project,
the only code the developer (may) need to write is the more involved,
vendor-specific logic.

To try Bocchi out with, you can use the example template
[here](./docs/template/examples/signalSciences.json).

## The Template

To create a new graph project using Bocchi, a developer needs to provide a JSON
template that Bocchi will interpret to generate graph code. The JSON template
defines key components of the integration, such as instance configuration
fields, the authentication method, as well as what steps the integration should
have. Moreoever, the steps outlined in the template contain information on what
API endpoints should be used for the step, as well as what entities and
relationships should be ingested.

<b>Currently, Bocchi only supports creating graph projects that ingest data from
REST APIs!</b>

Documentation for the JSON template can be found
[here](./docs/template/README.md).

Additionally, example template files can be found
[here](./docs/template/examples/).

## Usage

```
yarn j1-integration bocchi
```

## Additional Notes

### Authentication

Bocchi currently supports two different methods of authentication for
integrations: Endpoint authentication and Config Value authentication. If the
developer decides that Config Value authentication should be used for the
integration - that is, authentication information is provided in the instance
config - then the graph project Bocchi generates will have an incomplete
`verifyAuthentication()` function in the client. This is because the
graph-project generator does not know what endpoint to use for verifying
authentication.

<b>The developer will need to manually update the generated
verifyAuthentication() function and choose what endpoint should be used for
verifying authentication.</b>

### Types

After running Bocchi, the generated graph project will have a `types.ts` file
that contains TS types for the entities the integration will produce. The types
however will be `any`. This is because Bocchi cannot guess what properties will
be on the different entities the integration will produce. So for prosperity and
to follow best coding practices, <b>The types should be updated manually by the
developer.</b>

### Mapped Relationships

If a developer defines a mapped relationship(s) in the template, then they may
notice the following warning when running the integration locally:

```
The following types were encountered but are not declared in the step's "types" field:
```

If a step produces a mapped relationship(s), the developer will need to manually
add the `mappedRelationships` field in the generated stepMap for that step. The
`mappedRelationships` field will need to contain a valid
`StepMappedRelationshipMetadata` object (from
`@jupiterone/integration-sdk-core`).
