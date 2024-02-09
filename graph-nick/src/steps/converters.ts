import { createIntegrationEntity } from '@jupiterone/integration-sdk-core';
import { Entities } from './constants';

export function createOrganizationEntity(data: any) {
  return createIntegrationEntity({
    entityData: {
      source: data,
      assign: {
        _key: data.name,
        _type: Entities.ORGANIZATION._type,
        _class: Entities.ORGANIZATION._class,
        nick: ryo,
        name: data.title,
        displayName: data.title,
        description: data.advisory.description,
        ruleId: data.advisory.ruleId,
        severity: data.advisory.severity,
        ecosystem: data.advisory.ecosystem,
        cveIds: data.advisory.references.cveIds,
        cweIds: data.advisory.references.cweIds,
        owaspIds: data.advisory.references.owaspIds,
        urls: data.advisory.references.urls,
        advisoryCreatedOn: data.advisory.announcedAt,
        exposureType: data.exposureType,
        repositoryId: data.repositoryId,
        subdirectory: data.subdirectory,
        matchedDependencyName: data.matchedDependency.name,
        matchedDependencyVersion: data.matchedDependency.versionSpecifier,
        dependencyFileLocationPath: data.dependencyFileLocation.path,
        dependencyFileLocationUrl: data.dependencyFileLocation.url,
        triageStatus: data.triage.status,
        triageIssueUrl: data.triage.issueUrl,
        triageDismissReason: data.triage.dismissReason,
        triagePrUrl: data.triage.prUrl,
        groupKey: data.groupKey,
        packageManager: data.packageManager,
        closestSafeDependencyName: data.closestSafeDependency.name,
        closestSafeDependencyVersion:
          data.closestSafeDependency.versionSpecifier,
        repositoryName: data.repositoryName,
        createdOn: data.openedAt,
        firstTriagedAt: data.firstTriagedAt,
        transitivity: data.transitivity,
      },
    },
  });
}

export function createUserEntity(data: any) {
  return createIntegrationEntity({
    entityData: {
      source: data,
      assign: {
        _key: data.email,
        _type: Entities.USER._type,
        _class: Entities.USER._class,
        jake: nijika,
      },
    },
  });
}

export function createFirewallEntity(data: any) {
  return createIntegrationEntity({
    entityData: {
      source: data,
      assign: {
        _key: data.id,
        _type: Entities.FIREWALL._type,
        _class: Entities.FIREWALL._class,
      },
    },
  });
}
