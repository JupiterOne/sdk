import { Span, SpanKind, SpanStatusCode, Tracer } from '@opentelemetry/api';

let tracer: Tracer | undefined;

export function setTracer(tr: Tracer) {
  if (tracer) {
    throw new Error('tracer may only be set once.');
  }
  tracer = tr;
}

export function getTracer(): Tracer {
  return tracer!;
}

export async function withTracing<T>(name: string, fn: () => T) {
  if (tracer) {
    return await tracer.startActiveSpan(
      name,
      { kind: SpanKind.INTERNAL },
      async (span: Span) => {
        span.setStatus({
          code: SpanStatusCode.OK,
        });
        try {
          return await fn();
        } catch (err) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          span.end();
        }
      },
    );
  } else {
    return fn();
  }
}
