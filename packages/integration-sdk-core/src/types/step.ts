import { RelationshipClass } from '@jupiterone/data-model';

import {
  ExecutionContext,
  IntegrationStepExecutionContext,
  StepExecutionContext,
} from './context';
import { IntegrationInstanceConfig } from './instance';

export interface StepStartState {
  /**
   * Indicates the step is disabled and should not be
   * executed by the state machine.
   */
  disabled: boolean;
}

export type StepStartStates = Record<string, StepStartState>;

export type GetStepStartStatesFunction<T extends ExecutionContext> = (
  context: T,
) => StepStartStates | Promise<StepStartStates>;

export type ExecutionHandlerFunction<T extends StepExecutionContext> = (
  context: T,
) => Promise<void> | void;

export type StepExecutionHandlerFunction<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = ExecutionHandlerFunction<IntegrationStepExecutionContext<TConfig>>;

export enum StepResultStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  PARTIAL_SUCCESS_DUE_TO_DEPENDENCY_FAILURE = 'partial_success_due_to_dependency_failure',
  DISABLED = 'disabled',
  PENDING_EVALUATION = 'pending_evaluation',
}

export type Step<T extends StepExecutionContext> = StepMetadata & {
  /**
   * Function that runs to perform the stpe that
   */
  executionHandler: ExecutionHandlerFunction<T>;
};

export type IntegrationStepResult = Omit<
  StepMetadata,
  'entities' | 'relationships'
> & {
  status: StepResultStatus;

  /**
   * Entity or relationship types declared by the step definition.
   */
  declaredTypes: string[];

  /**
   * Entity or relationship types declared to be partial collections by the step
   * definition.
   */
  partialTypes: string[];

  /**
   * Entity or relationship types encountered during step execution.
   */
  encounteredTypes: string[];
};

export type IntegrationStep<
  TConfig extends IntegrationInstanceConfig = IntegrationInstanceConfig
> = StepMetadata & Step<IntegrationStepExecutionContext<TConfig>>;

export interface StepGraphObjectMetadata {
  _type: string;

  /**
   * Indicates the set of data represented by this `_type` should always be
   * considered a partial dataset.
   *
   * This is useful in steps that ingest an ever growing collection of a type of
   * data, ensuring the synchronization system does not delete older data that
   * will not be seen as ingestion progresses through the collection over
   * numerous executions. For example:
   *
   * * Vulnerability findings
   * * SCM pull requests
   * * Ticket systems
   */
  partial?: boolean;
}

export interface StepEntityMetadata extends StepGraphObjectMetadata {
  /**
   * The natural resource name in the integration provider. For example:
   *
   * "S3 Bucket"
   */
  resourceName: string;
  _class: string | string[];
}

export interface StepRelationshipMetadata extends StepGraphObjectMetadata {
  _class: RelationshipClass;
  sourceType: string;
  targetType: string;
}

export interface StepGraphObjectMetadataProperties {
  /**
   * Metadata about the entities ingested in this integration step. This is
   * used to generate documentation.
   */
  entities: StepEntityMetadata[];

  /**
   * Metadata about the relationships ingested in this integration step. This is
   * used to generate documentation.
   */
  relationships: StepRelationshipMetadata[];
}

export type StepMetadata = StepGraphObjectMetadataProperties & {
  /*
   * Identifier used to reference and track steps
   */
  id: string;

  /**
   * Friendly name that will be displayed in debug logs
   * and to customers in the job event log.
   */
  name: string;

  /**
   * An optional array of other step ids that need to execute
   * before the current step can.
   */
  dependsOn?: string[];
};
