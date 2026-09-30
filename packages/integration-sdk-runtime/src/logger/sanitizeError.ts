/**
 * Produces a log-safe, structured clone of an error (or any value) for
 * serialization.
 *
 * Context: the `err` bunyan serializer inspects errors with a depth of 10
 * (`util.inspect(err, false, 10)`). For errors thrown by axios/gaxios-family
 * HTTP clients, the error keeps a reference to the live `ClientRequest` and its
 * still-attached TLS `Socket`. A deep inspect walks into the socket and reaches
 * the original request headers — including `Authorization: Bearer <token>` —
 * via a Node-internal socket property (`Symbol(connect-options)`). Path-based
 * redactors that only patch known object paths (`config.headers`,
 * `request._header`, `kOutHeaders`) never reach the socket, so the credential
 * leaks into logs.
 *
 * This sanitizer defends at the serialization choke point instead of per path:
 *
 * 1. Live transport objects (Socket/TLSSocket, http(s).Agent, ClientRequest,
 *    IncomingMessage, streams, Buffers) are replaced with a `[Type]` tag and
 *    never walked — so `Symbol(connect-options)` is unreachable.
 * 2. Any property whose key looks credential-bearing (string OR symbol key) is
 *    redacted, wherever it appears in the graph.
 * 3. String values are scrubbed for inline `Bearer <token>` / `Authorization:`
 *    occurrences (e.g. a raw `request._header` blob).
 * 4. The walk is cycle-guarded and depth-bounded, and never mutates the input.
 */

export const REDACTED = '[REDACTED]';

const MAX_DEPTH = 10;

/**
 * Keys whose values are redacted wherever they appear. Matched
 * case-insensitively against the string key (or a symbol's description).
 */
const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|token|secret|password|passwd|credential|assertion|api[_-]?key|private[_-]?key|passphrase|session[_-]?id/i;

/**
 * Constructor names of live, non-serializable transport objects that must
 * never be walked — they hold references (sockets, connect-options) that carry
 * credentials. Matched against `constructor.name` to stay resilient across Node
 * versions without importing `net`/`tls`/`http`.
 */
const OPAQUE_CONSTRUCTOR_PATTERN =
  /^(TLSSocket|Socket|Agent|HTTPSAgent|HttpsAgent|HttpAgent|ClientRequest|IncomingMessage|ServerResponse|TLSWrap|TCP|Server|HTTPParser)$/;

/** Redact `Bearer <token>` and `Authorization: <value>` inside free-text. */
function scrubString(value: string): string {
  return value
    .replace(/Bearer\s+[^\s"'\\]+/gi, `Bearer ${REDACTED}`)
    .replace(/(Authorization\s*[:=]\s*)[^\s,;"'\\]+/gi, `$1${REDACTED}`);
}

function isOpaqueTransport(value: object): string | undefined {
  // Streams (ClientRequest, Socket, responses) duck-typed via readable/writable
  // internals in case the constructor name is minified or unexpected.
  const anyValue = value as Record<string, unknown>;
  if (
    typeof anyValue.pipe === 'function' &&
    (anyValue._readableState !== undefined ||
      anyValue._writableState !== undefined)
  ) {
    return `[${value.constructor?.name ?? 'Stream'}]`;
  }

  const name = value.constructor?.name;
  if (name && OPAQUE_CONSTRUCTOR_PATTERN.test(name)) {
    return `[${name}]`;
  }

  return undefined;
}

function keyIsSensitive(key: string | symbol): boolean {
  const asString = typeof key === 'symbol' ? key.description ?? '' : key;
  return SENSITIVE_KEY_PATTERN.test(asString);
}

function sanitize(value: unknown, depth: number, seen: WeakSet<object>): any {
  if (value === null || value === undefined) return value;

  const type = typeof value;

  if (type === 'string') return scrubString(value as string);
  if (type === 'number' || type === 'boolean' || type === 'bigint') {
    return value;
  }
  if (type === 'function')
    return `[Function ${(value as any).name || 'anonymous'}]`;
  if (type === 'symbol') return (value as symbol).toString();

  // Only objects remain.
  const obj = value as object;

  if (seen.has(obj)) return '[Circular]';

  if (Buffer.isBuffer(obj)) return `[Buffer ${obj.length} bytes]`;

  const opaque = isOpaqueTransport(obj);
  if (opaque) return opaque;

  if (depth >= MAX_DEPTH) return '[Truncated]';

  seen.add(obj);
  try {
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitize(item, depth + 1, seen));
    }

    const out: Record<string, unknown> = {};

    // Preserve Error identity fields that are non-enumerable on Error instances.
    if (obj instanceof Error) {
      out.name = obj.name;
      out.message = scrubString(obj.message);
      if (obj.stack) out.stack = scrubString(obj.stack);
    }

    const keys: (string | symbol)[] = [
      ...Object.keys(obj),
      ...Object.getOwnPropertySymbols(obj),
    ];

    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, key);
      // Skip getters — accessing them can throw or have side effects.
      if (!descriptor || descriptor.get) continue;

      const label = typeof key === 'symbol' ? key.toString() : key;

      if (keyIsSensitive(key)) {
        out[label] = REDACTED;
        continue;
      }

      out[label] = sanitize(descriptor.value, depth + 1, seen);
    }

    return out;
  } finally {
    seen.delete(obj);
  }
}

/**
 * Returns a log-safe, structured clone of `err` with credentials redacted and
 * live transport objects tagged rather than walked. Never mutates the input.
 */
export function sanitizeError(err: unknown): unknown {
  return sanitize(err, 0, new WeakSet());
}
