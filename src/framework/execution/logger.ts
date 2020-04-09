import Logger from 'bunyan';

import {
  IntegrationLogger,
  IntegrationInstance,
  IntegrationInvocationConfig,
  IntegrationInstanceConfigFieldMap,
} from './types';

/**
 * Create a logger for the integration that will include invocation details and
 * serializers common to all integrations.
 */
export function createIntegrationLogger(
  integrationName: string,
  invocationConfig: IntegrationInvocationConfig,
  serializers?: Logger.Serializers,
): IntegrationLogger {
  const logger = Logger.createLogger({
    name: integrationName,
    level: (process.env.LOG_LEVEL || 'info') as Logger.LogLevel,
    serializers: {
      err: Logger.stdSerializers.err,
    },
  });

  const serializeInstanceConfig = createInstanceConfigSerializer(
    invocationConfig.instanceConfigFields,
  );

  logger.addSerializers({
    integrationInstanceConfig: serializeInstanceConfig,
    // since config is serializable from
    instance: (instance: IntegrationInstance) => ({
      ...instance,
      config: instance.config
        ? serializeInstanceConfig(instance.config)
        : undefined,
    }),
  });

  if (serializers) {
    logger.addSerializers(serializers);
  }

  return instrumentVerboseTrace(logger);
}

function createInstanceConfigSerializer(
  fields?: IntegrationInstanceConfigFieldMap,
) {
  return (config: any) => {
    if (!config) {
      return config;
    } else {
      const serialized: any = {};
      for (const k of Object.keys(config)) {
        const field = fields && fields[k];
        if (field) {
          serialized[k] = field.mask
            ? `****${config[k].substr(-4)}`
            : config[k];
        } else {
          serialized[k] = '***';
        }
      }
      return serialized;
    }
  };
}

function instrumentVerboseTrace(logger: Logger): Logger {
  const trace = logger.trace;
  const child = logger.child;

  Object.assign(logger, {
    trace: (...params: any[]) => {
      if (params.length === 0) {
        return trace.apply(logger);
      }

      let additionalFields: Record<string, any> = {};
      let remainingArgs: any[] = params;
      if (params[0] instanceof Error) {
        additionalFields = { err: params[0] };
        remainingArgs = params.slice(1);
      } else if (typeof params[0] === 'object') {
        additionalFields = params[0];
        remainingArgs = params.slice(1);
      }

      trace.apply(logger, [
        { verbose: true, ...additionalFields },
        ...remainingArgs,
      ]);
    },

    child: (options: object = {}, simple?: boolean) => {
      const c = child.apply(logger, [options, simple]);
      return instrumentVerboseTrace(c);
    },
  });

  return logger;
}
