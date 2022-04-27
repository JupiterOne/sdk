# Integration SDK Errors Documentation

## Table of Contents

### Error Options?

### Errors

- Error 1
- Error 2

### `IntegrationError`

The base type of errors generated during integration execution. Integrations
should not throw this error type directly; use one of the types documented
below.

All errors occurring during execution of an integration should ultimately end up
as an `IntegrationError`, or a subclass thereof, each expressing a `code`
reflecting the class of the error. In cases when an unhandled `Error` occurs,
which has no `code`, then `"UNEXPECTED_ERROR"` will be used in logging the
error.

Integrations generally need to throw errors in only a few cases:

1. `IntegrationProviderAuthenticationError` - during `validateInvocation`, when
   an attempt to authenticate with the provider has failed.
1. `IntegrationValidationError` - during `validateInvocation`, when the
   configuration is considered invalid in some way.
1. `IntegrationProviderAuthorizationError` - during requests to the provider API
   and a `403 Forbidden` or similar response is provided.
1. `IntegrationProviderAPIError` - during requests to the provider API and an
   unexpected response is provided.
1. `Error` - any unexpected error should not be caught in the integration; the
   step execution system will catch and report it.

The integration may catch errors, but they should not be considered terminal
when it does, and the `catch` block should call
`logger.warn({err: error }, "Message for production analysis")`. For example:

```ts
try {
  // something that could go wrong, but it is handled by the integration
} catch (error) {
  // log it for production analysis, but carry on because we know what we're doing
  logger.warn(
    { err: error },
    "Nothing we can't handle, but someone may come asking",
  );
}
```
