import { RelationshipClass } from '@jupiterone/integration-sdk-core';

export const StepType = {
  SINGLETON: 'singleton',
  FETCH_ENTITIES: 'fetch-entities',
  FETCH_CHILD_ENTITIES: 'fetch-child-entities',
  BUILD_RELATIONSHIPS: 'build-relationships',
};

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
    name: string;
    _type: string;
    _class: string | Array<string>;
    _keyPath: string;
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
    params?: Record<string, any>;
    tokens?: number;
  };
  response: {
    dataPath: string;
    responseType: 'SINGLETON' | 'LIST';
    nextTokenPath?: string;
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
