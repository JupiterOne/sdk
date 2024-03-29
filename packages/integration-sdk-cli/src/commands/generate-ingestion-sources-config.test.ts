import {
  IntegrationIngestionConfigFieldMap,
  IntegrationStep,
  IntegrationInstanceConfig,
} from '@jupiterone/integration-sdk-core';
import { generateIngestionSourcesConfig } from './generate-ingestion-sources-config';

describe('#generateIngestionSourcesConfig', () => {
  const INGESTION_SOURCE_IDS = {
    FINDING_ALERTS: 'finding-alerts',
    FETCH_REPOS: 'fetch-repos',
    TEST_SOURCE: 'test-source',
  };

  const ingestionConfig: IntegrationIngestionConfigFieldMap = {
    [INGESTION_SOURCE_IDS.FINDING_ALERTS]: {
      title: 'Finding Alerts',
      description:
        'Dependabot vulnerability alert ingestion and Code scanning alerts',
      defaultsToDisabled: true,
    },
    [INGESTION_SOURCE_IDS.FETCH_REPOS]: {
      title: 'Fetch repos',
      description: 'This is an ingestion source created for test purposes',
      defaultsToDisabled: false,
    },
  };

  it('should return the ingestionConfig with empty childIngestionSources', () => {
    const integrationSteps: IntegrationStep<IntegrationInstanceConfig>[] = [
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
    const ingestionSourcesConfig = generateIngestionSourcesConfig(
      ingestionConfig,
      integrationSteps,
    );
    expect(
      ingestionSourcesConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS],
    ).toMatchObject(ingestionConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS]);
    // childIngestionSources is empty because there are no steps that depends on fetch-vulnerability-alerts
    expect(
      ingestionSourcesConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS]
        .childIngestionSources,
    ).toBeEmpty();
    // ingestionSourcesConfig[INGESTION_SOURCE_IDS.FETCH_REPOS] is undefined because there are no steps using that ingestionSourceId
    expect(
      ingestionSourcesConfig[INGESTION_SOURCE_IDS.FETCH_REPOS],
    ).toBeUndefined();
  });

  it('should return the ingestionConfig with childIngestionSources', () => {
    const stepFetchVulnerabilityAlerts = {
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
    };
    const stepFetchIssues = {
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
    };
    const integrationSteps: IntegrationStep<IntegrationInstanceConfig>[] = [
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
        ...stepFetchVulnerabilityAlerts,
        executionHandler: jest.fn(),
      },
      {
        ...stepFetchIssues,
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
    const ingestionSourcesConfig = generateIngestionSourcesConfig(
      ingestionConfig,
      integrationSteps,
    );
    // Original object doesn't change
    expect(
      ingestionSourcesConfig[INGESTION_SOURCE_IDS.FETCH_REPOS],
    ).toMatchObject(ingestionConfig[INGESTION_SOURCE_IDS.FETCH_REPOS]);
    // New property added
    expect(
      ingestionSourcesConfig[INGESTION_SOURCE_IDS.FETCH_REPOS]
        .childIngestionSources,
    ).toEqual(
      expect.arrayContaining([stepFetchVulnerabilityAlerts, stepFetchIssues]),
    );
    // For FINDING_ALERTS the ingestionConfig keep exactly the same
    expect(
      ingestionSourcesConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS],
    ).toMatchObject(ingestionConfig[INGESTION_SOURCE_IDS.FINDING_ALERTS]);
  });

  it('should not add the source if it does not exist in the ingestionConfig', () => {
    const integrationSteps: IntegrationStep<IntegrationInstanceConfig>[] = [
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
        ingestionSourceId: INGESTION_SOURCE_IDS.TEST_SOURCE,
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
    ];
    const ingestionSourcesConfig = generateIngestionSourcesConfig(
      ingestionConfig,
      integrationSteps,
    );
    expect(
      ingestionSourcesConfig[INGESTION_SOURCE_IDS.TEST_SOURCE],
    ).toBeUndefined();
  });
});
