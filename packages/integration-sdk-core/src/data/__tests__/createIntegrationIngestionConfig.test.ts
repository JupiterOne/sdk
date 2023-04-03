import {
  IntegrationIngestionConfigData,
  IntegrationIngestionConfigFieldMap,
  IntegrationInstanceConfig,
  IntegrationStep,
} from '../../types';
import { createIntegrationIngestionConfig } from '../createIntegrationIngestionConfig';

describe('createIntegrationIngestionConfig', () => {
  const INGESTION_SOURCE_IDS = {
    FINDING_ALERTS: 'finding-alerts',
    FETCH_REPOS: 'fetch-repos',
  };
  
  const ingestionConfigData: IntegrationIngestionConfigData = {
    [INGESTION_SOURCE_IDS.FINDING_ALERTS]: {
      title: 'Finding Alerts',
      description:
        'Dependabot vulnerability alert ingestion and Code scanning alerts',
      defaultsToDisabled: true,
    },
    [INGESTION_SOURCE_IDS.FETCH_REPOS]: {
      title: 'Fetch Alerts',
      description: 'This is an ingestion source created fo test purposes',
      defaultsToDisabled: false,
    },
  };

  it('should return the ingestionConfig with empty childIngestionSources', () => {
    const vulnerabilityAlertsSteps: IntegrationStep<IntegrationInstanceConfig>[] =
      [
        {
          id: 'fetch-vulnerability-alerts',
          name: 'Fetch Vulnerability Alerts',
          entities: [
            {
              resourceName: 'GitHub Vulnerability Alerts',
              _type: 'github_finding',
              _class: ['Finding'],
            },
          ],
          relationships: [],
          dependsOn: ['fetch-repos'],
          ingestionSourceId: INGESTION_SOURCE_IDS.FINDING_ALERTS,
          executionHandler: jest.fn(),
        },
      ];
    const ingestionConfig: IntegrationIngestionConfigFieldMap =
      createIntegrationIngestionConfig(
        ingestionConfigData,
        vulnerabilityAlertsSteps,
      );
    // Original object doesn't change
    expect(ingestionConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS]).toMatchObject(
      ingestionConfigData[INGESTION_SOURCE_IDS.FINDING_ALERTS],
    );
    // childIngestionSources is empty because there are no steps that depends on fetch-vulnerability-alerts
    expect(
      ingestionConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS]
        .childIngestionSources,
    ).toBeEmpty();
  });

  it('should return the ingestionConfig with childIngestionSources', () => {
    const githubSteps: IntegrationStep<IntegrationInstanceConfig>[] = [
      {
        id: 'fetch-repos',
        name: 'Fetch Repos',
        entities: [
          {
            resourceName: 'Github Repo',
            _type: 'github_repo',
            _class: ['CodeRepo'],
          },
        ],
        relationships: [],
        dependsOn: ['fetch-account'],
        ingestionSourceId: INGESTION_SOURCE_IDS.FETCH_REPOS,
        executionHandler: jest.fn(),
      },
      {
        id: 'fetch-vulnerability-alerts',
        name: 'Fetch Vulnerability Alerts',
        entities: [
          {
            resourceName: 'GitHub Vulnerability Alerts',
            _type: 'github_finding',
            _class: ['Finding'],
          },
        ],
        relationships: [],
        dependsOn: ['fetch-repos'],
        ingestionSourceId: INGESTION_SOURCE_IDS.FINDING_ALERTS,
        executionHandler: jest.fn(),
      },
      {
        id: 'fetch-issues',
        name: 'Fetch Issues',
        entities: [
          {
            resourceName: 'GitHub Issue',
            _type: 'github_issue',
            _class: ['Issue'],
          },
        ],
        relationships: [],
        dependsOn: ['fetch-repos', 'fetch-users', 'fetch-collaborators'],
        executionHandler: jest.fn(),
      },
      {
        id: 'fetch-teams',
        name: 'Fetch Teams',
        entities: [
          {
            resourceName: 'GitHub Team',
            _type: 'github_team',
            _class: ['UserGroup'],
          },
        ],
        relationships: [],
        dependsOn: ['fetch-account'],
        executionHandler: jest.fn(),
      },
    ];
    const ingestionConfig: IntegrationIngestionConfigFieldMap =
      createIntegrationIngestionConfig(ingestionConfigData, githubSteps);
    // Original object doesn't change
    expect(ingestionConfig[INGESTION_SOURCE_IDS.FETCH_REPOS]).toMatchObject(
      ingestionConfigData[INGESTION_SOURCE_IDS.FETCH_REPOS],
    );
    // New property added
    expect(
      ingestionConfig[INGESTION_SOURCE_IDS.FETCH_REPOS].childIngestionSources,
    ).toEqual(['fetch-vulnerability-alerts', 'fetch-issues']);
    // For FINDING_ALERTS the ingestionConfig keep exactly the same
    expect(ingestionConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS]).toMatchObject(
      ingestionConfigData[INGESTION_SOURCE_IDS.FINDING_ALERTS],
    );
  });
});
