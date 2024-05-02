import { IntegrationInstanceConfig } from './instance';
import {
  GetStepStartStatesFunction,
  Step,
  StepExecutionHandlerWrapperFunction,
} from './step';
import { InvocationValidationFunction } from './validation';
import {
  ExecutionContext,
  IntegrationExecutionContext,
  StepExecutionContext,
  IntegrationStepExecutionContext,
  IntegrationExecutionConfig,
} from './context';
import { Entity } from './entity';
import { Relationship } from './relationship';

/**
 * Normalization transform for tracking keys in an integration. Allows
 * entities to be tracked and looked up using the provided transformation.
 * One use case of this normalization function is to track duplicates
 * among case-insensitive keys.
 *
 * Example:
 *   (_key: string) => _key.toLowerCase()
 */
export type KeyNormalizationFunction = (_key: string) => string;

export type BeforeAddEntityHookFunction<
  TExecutionContext extends ExecutionContext,
> = (context: TExecutionContext, entity: Entity) => Entity;

export type BeforeAddRelationshipHookFunction<
  TExecutionContext extends ExecutionContext,
> = (
  context: TExecutionContext,
  relationship: Relationship,
) => Promise<Relationship> | Relationship;

export type AfterAddEntityHookFunction<
  TExecutionContext extends ExecutionContext,
> = (context: TExecutionContext, entity: Entity) => Entity;

export type AfterAddRelationshipHookFunction<
  TExecutionContext extends ExecutionContext,
> = (context: TExecutionContext, relationship: Relationship) => Relationship;

export type LoadExecutionConfigFunction<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends
    IntegrationExecutionConfig = IntegrationExecutionConfig,
> = (options: { config: TInstanceConfig }) => TExecutionConfig;

export type AfterExecutionFunction<TExecutionContext extends ExecutionContext> =
  (context: TExecutionContext) => Promise<void>;

export interface InvocationConfig<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
> {
  validateInvocation?: InvocationValidationFunction<TExecutionContext>;
  /**
   * Called after an integration execution has completed. You may this this hook
   * for performing operations such as closing out open clients in an
   * integration.
   */
  afterExecution?: AfterExecutionFunction<TExecutionContext>;
  getStepStartStates?: GetStepStartStatesFunction<TExecutionContext>;
  integrationSteps: Step<TStepExecutionContext>[];
  normalizeGraphObjectKey?: KeyNormalizationFunction;
  beforeAddEntity?: BeforeAddEntityHookFunction<TExecutionContext>;
  beforeAddRelationship?: BeforeAddRelationshipHookFunction<TExecutionContext>;
  loadExecutionConfig?: LoadExecutionConfigFunction;
  /**
   * An optional array of identifiers used to execute dependency
   * graphs in a specific order. These values should match the
   * StepMetadata `dependencyGraphId` properties.
   *
   * If this is not provided, all steps will be evaluated in
   * the same dependency graph.
   */
  dependencyGraphOrder?: string[];
  /**
   * Optionally define the number of steps to execute in parallel.
   *
   * If this value is not provided, the concurrency defaults to
   * Number.POSITIVE_INFINITY
   */
  stepConcurrency?: number;
  /**
   * Optionally collect the encountered keys and return them in
   * the integration results. This can result in a large quantity
   * of keys being returned.
   *
   * If this value is not provided, the default is false.
   */
  collectEncounteredKeys?: boolean;
  /**
   * This configuration element is used to store information about data
   * ingestion sources that can be enabled or disabled. When this element
   * is provided, it is expected that one or more steps will reference
   * these ids so that if one of these elements is disabled, all steps and
   * dependencies will also be disabled.
   * In essence, the ingestionConfig allows grouping and controlling
   * the activation of a list of steps.
   *
   */
  ingestionConfig?: IntegrationIngestionConfigFieldMap;
  /**
   * Wraps the executionHandler for each step in an operation to allow for adding
   * context before and after the executionHandler completes. Can be used for adding
   * logic like tracing or logging.
   *
   * If not provided, the handler will run normally.
   */
  executionHandlerWrapper?: StepExecutionHandlerWrapperFunction<TStepExecutionContext>;
  /**
   * @expiremental
   * Expiremental feature to enable the on-disk duplicate key tracker
   * Requires the optional dependency `lmdb` and a valid `lmdb` build
   * This field may be removed in future releases with no major version change!
   */
  useOnDiskDuplicateKeyTracker?: boolean;
}

export interface IntegrationInvocationConfig<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
> extends InvocationConfig<
    IntegrationExecutionContext<TConfig>,
    IntegrationStepExecutionContext<TConfig>
  > {
  instanceConfigFields?: IntegrationInstanceConfigFieldMap<TConfig>;
}

export interface IntegrationInstanceConfigField {
  type?: 'string' | 'json' | 'boolean';
  mask?: boolean;
  optional?: boolean;
}

export type IntegrationInstanceConfigFieldMap<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
> = Record<keyof TConfig, IntegrationInstanceConfigField>;

export type IntegrationSourceId = string;

export interface IntegrationIngestionConfigField {
  title: string;
  description?: string;
  defaultsToDisabled?: boolean;
  cannotBeDisabled?: boolean;
}

export type IntegrationIngestionConfigFieldMap = Record<
  IntegrationSourceId,
  IntegrationIngestionConfigField
>;
