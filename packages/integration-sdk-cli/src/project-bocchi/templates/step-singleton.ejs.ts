import {
  Entity,
  IntegrationMissingKeyError,
  IntegrationStep,
  IntegrationStepExecutionContext,
  createDirectRelationship,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig } from '../../config';
import {
  Steps,
  Entities,
  Relationships,
  ORGANIZATION_ENTITY,
} from '../constants';
import { createAPIClient } from '../../client';
import { createApplicationEntity } from '../converters';

<%# This file represents a singleton step -%>
<%# Input: 
{
  "input": {
    "stepIdUpperSnakeCase": "FETCH_ORGANIZATION",
    "stepIdCamelCase": "fetchOrganization",
    "entityNamePascalCase": "Organization",
    "stepName": "Fetch Organization",
    "apiCall": false
  }
}-%>
export const <%- input.stepIdCamelCase %>Steps: IntegrationStep<IntegrationConfig>[] =[
  {
    id: Steps.<%- input.stepIdUpperSnakeCase %>,
    name: '<%-input.stepName%>',
    entities: [Entities.<%- input.stepIdUpperSnakeCase %>],
    relationships: [],
    dependsOn: [],
    executionHandler: <%- input.stepIdCamelCase %>,
  },
];

<%# Jake is bad at Fortnite - positive comments only %>
export async function <%-input.stepIdCamelCase %>({
  jobState,
  executionConfig,
  instance,
}: IntegrationStepExecutionContext<IntegrationConfig>) {
  <%_ if (input.apiCall) { _%>
  const client = createAPIClient(instance.config, executionConfig);

  const data = await client.<%- input.stepIdCamelCase %>();
  <%_ } %>
  await jobState.addEntity(build<%- input.entityNamePascalCase %>Entity(<%= input.apiCall ? 'data' : '' %>));
}
