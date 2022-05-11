import http from 'http';
import path from 'path';
import { promises as fs } from 'fs';

import { vol } from 'memfs';
import fetch from 'node-fetch';
import getPort from 'get-port';

import { toUnixPath } from '@jupiterone/integration-sdk-private-test-utils';

import {
  mutations,
  Recording,
  RecordingEntry,
  setupRecording,
} from '../recording';

// mock fs so that we don't store recordings
jest.mock('fs');

describe('recording tests with server & recording', () => {
  let recording: Recording;
  let server;

  beforeEach(async () => {
    server = await startServer();
  });

  afterEach(async () => {
    await server.close();
    await recording.stop();
    vol.reset();
  });

  test('create files relative to the recording directory based on the input name', async () => {
    const name = 'testing-name-test-test';
    recording = setupRecording({
      name,
      directory: __dirname,
    });

    await fetch(`http://localhost:${server.port}`);

    await recording.stop();

    expect(Object.keys(vol.toJSON())).toHaveLength(1);

    const [recordingPath] = Object.keys(vol.toJSON());

    expect(
      recordingPath.startsWith(
        toUnixPath(path.resolve(__dirname, '__recordings__', name)),
      ),
    ).toEqual(true);
  });

  test('accepts recordFailedRequests PollyConfig option', async () => {
    // start new server which responds with statusCode=404
    server.close();
    server = await startServer(404);

    const name = 'test-record-failed-requests';
    recording = setupRecording({
      name,
      directory: __dirname,
      options: {
        recordFailedRequests: true,
      },
    });

    await fetch(`http://localhost:${server.port}`);

    await recording.stop();

    expect(Object.keys(vol.toJSON())).toHaveLength(1);

    const [recordingPath] = Object.keys(vol.toJSON());

    expect(
      recordingPath.startsWith(
        toUnixPath(path.resolve(__dirname, '__recordings__', name)),
      ),
    ).toEqual(true);
  });

  test('redacts cookies from responses', async () => {
    recording = setupRecording({
      name: 'test',
      directory: __dirname,
    });

    await fetch(`http://localhost:${server.port}`);
    await recording.stop();

    const har = await getRecording();

    expect(har.log.entries[0].response.cookies).toContainEqual(
      expect.objectContaining({
        name: 'cookies',
        value: '[REDACTED]',
      }),
    );

    expect(har.log.entries[0].response.headers).toContainEqual(
      expect.objectContaining({
        name: 'set-cookie',
        value: '[REDACTED]',
      }),
    );
  });

  test('always redacts headers that are well known sensitive headers', async () => {
    recording = setupRecording({
      name: 'test',
      directory: __dirname,
    });

    await fetch(`http://localhost:${server.port}`, {
      headers: {
        authorization: 'Bearer MyToken',
      },
    });

    await recording.stop();

    const har = await getRecording();

    expect(har.log.entries[0].request.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'authorization',
          value: '[REDACTED]',
        }),
      ]),
    );
  });

  test('redacts headers based on input', async () => {
    recording = setupRecording({
      name: 'test',
      directory: __dirname,
      redactedRequestHeaders: ['secret-a', 'secret-b'],
      redactedResponseHeaders: ['my-secret-header', 'my-other-secret-header'],
    });

    await fetch(`http://localhost:${server.port}`, {
      headers: {
        'secret-a': 'oooh a secret',
        'secret-b': 'oooh another secret',
      },
    });

    await recording.stop();

    const har = await getRecording();

    expect(har.log.entries[0].request.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'secret-a',
          value: '[REDACTED]',
        }),
        expect.objectContaining({
          name: 'secret-b',
          value: '[REDACTED]',
        }),
      ]),
    );

    expect(har.log.entries[0].response.headers).toEqual(
      expect.arrayContaining([
        {
          name: 'my-secret-header',
          value: '[REDACTED]',
        },
        {
          name: 'my-other-secret-header',
          value: '[REDACTED]',
        },
        {
          name: 'my-not-so-secret-header',
          value: 'nothing important here',
        },
      ]),
    );
  });

  test('allows for entries to be mutated via mutateEntry function', async () => {
    const mutateEntry = jest.fn((entry) => {
      // remove all headers
      entry.response.headers = [];
      entry.request.headers = [];
    });

    recording = setupRecording({
      name: 'test',
      directory: __dirname,
      mutateEntry,
    });

    await fetch(`http://localhost:${server.port}`, {
      headers: {
        'secret-a': 'oooh a secret',
        'secret-b': 'oooh another secret',
      },
    });

    await recording.stop();

    const har = await getRecording();

    expect(har.log.entries[0].response.headers).toEqual([]);
    expect(har.log.entries[0].request.headers).toEqual([]);
  });

  test('allows for overriding matchRequestBy options with deepDefault', async () => {
    recording = setupRecording({
      name: 'test',
      directory: __dirname,
      options: {
        matchRequestsBy: {
          order: false,
          url: {
            query: false,
          },
        },
      },
    });

    await fetch(`http://localhost:${server.port}/query?q=1`);
    await fetch(`http://localhost:${server.port}/query?q=2`);
    await recording.stop();

    const har = await getRecording();
    expect(har.log.entries).toHaveLength(1);
  });

  test('allows mutating a request preflight changing what is stored in the har file.', async () => {
    const header = 'test-header';
    const headerVal = 'oh hai';
    recording = setupRecording({
      name: 'test',
      directory: __dirname,
      options: {
        matchRequestsBy: {
          order: false,
          url: {
            query: false,
          },
        },
      },
      mutateRequest: (request) => {
        const [incomingHeaderVal] = request.getHeader(header);
        // un gzip the body so polly can save it.
        if (incomingHeaderVal === headerVal) {
          request.body = 'mutated';
        }
      },
    });

    await fetch(`http://localhost:${server.port}`, {
      method: 'post',
      body: 'not mutated',
      headers: {
        [header]: headerVal,
      },
    });
    await recording.stop();

    const har = await getRecording();
    expect(har.log.entries).toHaveLength(1);
    expect(
      har.log.entries.some((e: any) => e.request.postData.text === 'mutated'),
    ).toEqual(true);
  });
});

test('unzipGzippedRecordingEntry with base64 encoding', () => {
  // Arrange
  const recordingEntry = {
    response: {
      content: {
        encoding: 'base64',
        text: '["H4sIAAAAAAAAA51VXWvbMBT9L3pOKlttWmYYg7H3MuhTxzCKfeNolSVNklOy0P++IzuZ7dC1pC+Jc33Pued+5sBUzQpxvRIiv71eMFlVtjORFQembaMMK9ivfKlMQyGyRe+cZxn8b0W+YMbWVCYbuy+fmm/3Xzd69fgdfnIno/Rl5zXebWN0oeB8MIarRsVtt+4C+cqaSCZeVbblHf9H/GX3+QYkjT/S9BFgOKNz6kg14MEX+FTsNrb6TMIQuvefem6s1vYZ+HPFb4bg/2DQNjyjUB+hAOzAbdwSSoY0XlLyKsQL5fSQA09faEoiCWiCp/oySUcQBD0baDlwT872bN06VF65qKy5UA==","2gwKKusbadQf+QEqQAMYkqgLRfQQQGmHmbsQO2AO3Hm1k9U+lcNTRWqH6n6E7wwMurh3lBZpUplUcxWplHWbNnEjdaCXY+oqWr8vA2mqUhGBlFoDgAWmEMpon+i9JknnuDJot9ZDI/jpDvAZy6naKaSidwo3JewnBxn0MLC8vZCzmRjXkweKEQsS/qM15excf4Xyu5u7LB0x/A66a9Lx6hwq6K2hZXC20xGlQq2lbygtyeyaHa2vN8KRb1UIafTTccRjh5wKTIGswdhSu8b9GA2BKk9x5hFljas4upDZKShr0zSOVtdpXXr6DfqpuZ8BbLbvWzW6T6uGcTgLOnv7OgUGahhgVvz4uWAgkBFDLfEfwEQmxDITSyEe8k/FKituVldZlj0i4c4hmbnf9TLPHkReiNtCZCe/gNZpKjcKH0a2GHGDBDELMpQt+qEcXkycUIl+ztPoj0gn4xZvksDQBUemRuj1/kQ22pLsFODlL63SGyfZBgAA"]',
      },
      headers: [{ name: 'content-encoding', value: 'gzip' }],
    },
  } as RecordingEntry;

  // Act
  mutations.unzipGzippedRecordingEntry(recordingEntry);

  // Assert
  expect(recordingEntry.response.content.text).toBe(
    '{"id":23522163,"account":{"login":"j1-ingest","id":100235621,"node_id":"O_kgDOBfl5ZQ","avatar_url":"https://avatars.githubusercontent.com/u/100235621?v=4","gravatar_id":"","url":"https://api.github.com/users/j1-ingest","html_url":"https://github.com/j1-ingest","followers_url":"https://api.github.com/users/j1-ingest/followers","following_url":"https://api.github.com/users/j1-ingest/following{/other_user}","gists_url":"https://api.github.com/users/j1-ingest/gists{/gist_id}","starred_url":"https://api.github.com/users/j1-ingest/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/j1-ingest/subscriptions","organizations_url":"https://api.github.com/users/j1-ingest/orgs","repos_url":"https://api.github.com/users/j1-ingest/repos","events_url":"https://api.github.com/users/j1-ingest/events{/privacy}","received_events_url":"https://api.github.com/users/j1-ingest/received_events","type":"Organization","site_admin":false},"repository_selection":"all","access_tokens_url":"https://api.github.com/app/installations/23522163/access_tokens","repositories_url":"https://api.github.com/installation/repositories","html_url":"https://github.com/organizations/j1-ingest/settings/installations/23522163","app_id":174703,"app_slug":"jupiterone-spoulton","target_id":100235621,"target_type":"Organization","permissions":{"issues":"read","members":"read","secrets":"read","metadata":"read","environments":"read","pull_requests":"read","administration":"read","organization_secrets":"read","organization_administration":"read"},"events":[],"created_at":"2022-02-22T19:50:45.000Z","updated_at":"2022-03-10T21:26:20.000Z","single_file_name":null,"has_multiple_single_files":false,"single_file_paths":[],"suspended_by":null,"suspended_at":null}',
  );
});

test('unzipGzippedRecordingEntry with hex encoding', () => {
  // Arrange
  const recordingEntry = {
    response: {
      content: {
        text: '["1f8b08000000000004039596cd6e842010c7dfc573492f3df5d4571961541481c058b3dbf4dd8b0513b759a09cfdcdf7cc1fbfba8f79b392d0198dafdaae0cf5601c47062376efddeec2b7eee5814a066c051d20c1a4261c1d90349a79b154acaef468cca86a61ae069fe8801b9133393f33ae246a6ac82454afcc2875c6649f421b26a076c7bc1738a0f6b994cf665eab3ca365927966621682321e2a4cd9331d3a38fb32fe30d51deedbd4c0cfd255b27970efc3ace431005de9d251032874c4dca6b0a502420dbd3a3a6036d15089b16176931c5a76698675c884f0c8b7705137668d92fcc60857ab809a4a99802fbfe79a89f16c3dc2fc5ca5b7674afd269540d7e09c2687409e425e0d568b367b8f6f0d167794b931787d5bda6ff3b0aac4e713e81193d4ad614fcb511af15e52bf856912b38e0924e464729d0f0a6b27561a64240adb270ccfdd4cb4ad8955a48aaa1d91da8ea654f3321181f28e44a6a07c09284b7b84ea1294b8fcca44e03f4293c8ead944ae2641913a9fbecc3e47a8a4e389480f5dd1cdbcadb624a4d1157766179e9c5c72caf3570dcbd213bd82743b10cfbd46671546e6365d00015bc30ba832355e5fe2ebefccf70ff229a1162c090000"]',
      },
      headers: [{ name: 'content-encoding', value: 'gzip' }],
    },
  } as RecordingEntry;

  // Act
  mutations.unzipGzippedRecordingEntry(recordingEntry);

  // Assert
  expect(recordingEntry.response.content.text).toBe(
    '{"@jupiterone/npm-enforce-age":"write","@jupiterone/jupiter-managed-integration-sdk":"write","@jupiterone/jupiter-integration-google":"write","@jupiterone/jupiter-integration-veracode":"write","@jupiterone/veracode-client":"write","@jupiterone/jupiter-integration-onelogin":"write","@jupiterone/whitehat-client":"write","@jupiterone/jupiter-integration-cbdefense":"write","@jupiterone/jupiter-integration-whitehat":"write","@jupiterone/jupiter-integration-okta":"write","@jupiterone/jupiterone-client-nodejs":"write","@jupiterone/jupiter-integration-wazuh":"write","@jupiterone/jupiter-integration-jira":"write","@jupiterone/jupiter-integration-sentinelone":"write","@jupiterone/jupiterone-alert-rules":"write","@jupiterone/jupiter-integration-tenable-cloud":"write","@jupiterone/jupiter-integration-openshift":"write","@jupiterone/jupiter-integration-jamf":"write","@jupiterone/security-policy-templates":"write","@jupiterone/jupiter-integration-hackerone":"write","@jupiterone/jupiter-integration-azure":"write","@jupiterone/jupiter-policy-builder":"write","@jupiterone/jupiter-integration-threatstack":"write","@jupiterone/jupiter-integration-knowbe4":"write","@jupiterone/jupiter-integration-zeit":"write","@jupiterone/snyk-client":"write","@jupiterone/jupiter-integration-snyk":"write","@jupiterone/jupiter-change-management-client":"write","@jupiterone/change-management-client":"write","@jupiterone/bitbucket-pr-detector":"write","@jupiterone/graph-azure":"write","@jupiterone/graph-jamf":"write","@jupiterone/docs":"write","@jupiterone/graph-cbdefense":"write","@jupiterone/graph-google":"write","@jupiterone/graph-hackerone":"write","@jupiterone/graph-jira":"write","@jupiterone/graph-knowbe4":"write","@jupiterone/graph-okta":"write","@jupiterone/graph-onelogin":"write","@jupiterone/graph-sentinelone":"write","@jupiterone/graph-snyk":"write","@jupiterone/graph-tenable-cloud":"write","@jupiterone/graph-threatstack":"write","@jupiterone/graph-openshift":"write","@jupiterone/graph-veracode":"write","@jupiterone/graph-wazuh":"write","@jupiterone/graph-whitehat":"write","@jupiterone/graph-jumpcloud":"write","@jupiterone/graph-crowdstrike":"write","@jupiterone/security-policy-builder":"write","@jupiterone/graph-airwatch":"write","@jupiterone/graph-whois":"write","@jupiterone/data-model":"write","@jupiterone/integration-sdk":"write"}',
  );
});

async function startServer(statusCode?: number) {
  const recordingStatusCode = statusCode ?? 200;
  const server = http.createServer((req, res) => {
    res.writeHead(recordingStatusCode, {
      'content-type': 'application/json',
      'set-cookie': 'cookies=taste-good',
      'my-secret-header': 'super secret',
      'my-other-secret-header': 'super super secret',
      'my-not-so-secret-header': 'nothing important here',
    });
    res.write(JSON.stringify({ test: true }));
    res.end();
  });

  const port = await getPort();
  server.listen(port);

  return {
    close: () => new Promise((resolve) => server.close(resolve)),
    port,
  };
}

async function getRecording() {
  const [recordingPath] = Object.keys(vol.toJSON());

  const rawRecording = await fs.readFile(recordingPath, 'utf8');

  return JSON.parse(rawRecording);
}
