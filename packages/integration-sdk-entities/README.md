# @jupiterone/integration-sdk-entities

This package contains all typescript types generated from J1's data model to be
used throughout J1 systems. These should not be considered the source of truth
for the entity definitions, instead reference the `data-model` to find the
source of truth.

# Generating the types

You need the following packages installed to generate the types, unfortunately
because the converter requires that the node version is at least 16 you'll need
to manually install them to get this working.

```
    "json-schema-to-typescript": "^12.0.0",
    "ts-dedupe": "^0.3.1"
```

To generate the types after these are installed simply run
`npm run generate-ts-classes`

It reads directly from node_modules to get the schemas so ensure that you have
the proper version of the data model installed before trying to execute this
command.

## Installation

```
npm install @jupiterone/integration-sdk-entities

# or

npm install @jupiterone/integration-sdk-entities
```
