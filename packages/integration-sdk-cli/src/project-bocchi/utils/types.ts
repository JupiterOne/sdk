import { RelationshipClass } from '@jupiterone/integration-sdk-core';

export type StepType =
  | 'singleton'
  | 'fetch-entities'
  | 'fetch-child-entities'
  | 'fetch-relationships';

export interface Template {
  instanceConfigFields: {
    [propertyName: string]: IntegrationConfigProperty;
  };
  authentication: EndpointAuthentication | ConfigFieldAuthentication;
  baseUrl: string;
  tokenBucket?: {
    maximumCapacity: number;
    refillRate: number;
  };
  // Unimplemented
  // paginationTokenStrategy:
  steps: Step[];
}

interface IntegrationConfigProperty {
  type?: 'string' | 'json' | 'boolean';
  mask?: Boolean;
  optional?: Boolean;
}

interface EndpointAuthentication {
  strategy: 'endpoint';
  params: {
    path: string;
    method: 'GET' | 'POST';
    body?: Record<string, any>;
    headers?: Record<string, string>;
  };
  // TODO: outputHeaders
}

interface ConfigFieldAuthentication {
  strategy: 'configField';
  // TODO: outputHeaders
}

export interface Step {
  id: string;
  name: string;
  entity: {
    _type: string;
    _class: string | Array<string>;
    _keyFormat: string;
    fieldMappings?: {
      [entityProperty: string]: string;
    };
    staticFields?: {
      [entityProperty: string]: string;
    };
  };
  parentAssociation?: {
    parentEntityType: string;
    relationshipClass: string;
  };
  // TODO: api client needs to be able to do GETs and POSTs based on this
  request: {
    urlTemplate: string;
    method?: 'GET' | 'POST';
    parms?: Record<string, any>;
    tokens?: number;
  };
  response: {
    dataPath: string;
    nextTokenPath?: string;
    responseType: 'SINGLETON' | 'LIST';
  };
  directRelationships?: {
    targetKey: string;
    targetType: string;
    _class: RelationshipClass;
    direction: 'FORWARD' | 'REVERSE';
  }[];
  mappedRelationships?: {
    _class: RelationshipClass;
    direction: 'FORWARD' | 'REVERSE';
    fieldMappings:
      | {
          sourceProperty: string;
          targetProperty: string;
        }
      | {
          targetValue: string;
          targetProperty: string;
        };
  };
  dependsOn?: string[];
}
