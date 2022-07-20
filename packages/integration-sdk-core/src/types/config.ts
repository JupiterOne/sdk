import { IntegrationInstanceConfig } from './instance';
import { GetStepStartStatesFunction, Step } from './step';
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

export type LoadExecutionConfigFunction<
  TInstanceConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
  TExecutionConfig extends IntegrationExecutionConfig = IntegrationExecutionConfig,
> = (options: { config: TInstanceConfig }) => TExecutionConfig;

export interface InvocationConfig<
  TExecutionContext extends ExecutionContext,
  TStepExecutionContext extends StepExecutionContext,
> {
  validateInvocation?: InvocationValidationFunction<TExecutionContext>;
  getStepStartStates?: GetStepStartStatesFunction<TExecutionContext>;
  integrationSteps: Step<TStepExecutionContext>[];
  normalizeGraphObjectKey?: KeyNormalizationFunction;
  beforeAddEntity?: BeforeAddEntityHookFunction<TExecutionContext>;
  beforeAddRelationship?: BeforeAddRelationshipHookFunction<TExecutionContext>;
  loadExecutionConfig?: LoadExecutionConfigFunction;
  /**
   * An optional array of identifiers used to execute dependency
   * graphs in a specific order. These values should match the
   * StepMetadata `dependencyGraphId` prpoperties.
   *
   * If this is not provided, all steps will be evaluated in
   * the same dependency graph.
   */
  dependencyGraphOrder?: string[];
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
  type?: 'string' | 'boolean';
  mask?: boolean;
}

export type IntegrationInstanceConfigFieldMap<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig,
> = Record<keyof TConfig, IntegrationInstanceConfigField>;
