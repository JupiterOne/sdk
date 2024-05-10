import { RelationshipClass } from '@jupiterone/integration-sdk-core';

export const StepType = {
  SINGLETON: 'singleton',
  CHILD_SINGLETON: 'child-singleton',
  FETCH_ENTITIES: 'fetch-entities',
  FETCH_CHILD_ENTITIES: 'fetch-child-entities',
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
  authHeaders: AuthenticationHeaders;
}

/**
 * Authentication headers to be used in API requests.
 * The `Authorization` header is required, and is typically
 * a bearer token or API key.
 */
interface AuthenticationHeaders {
  Authorization: string;
  [headerName: string]: string;
}

interface ConfigFieldAuthentication {
  strategy: 'configField';
  authHeaders: {
    [headerName: string]: string;
  };
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
  request: {
    urlTemplate: string;
    method?: 'GET' | 'POST';
    params?: Record<string, any>;
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
    fieldMappings?:
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
