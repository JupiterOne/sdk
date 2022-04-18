// import { createMockIntegrationLogger } from '@jupiterone/integration-sdk-testing';
import * as tester from '@jupiterone/integration-sdk-testing';;
import { APIClient } from '../index';

// const fakeData = {test: "test"};

// function setupFetchStub(data) {
//   return function fetchStub(_url) {
//     return new Promise((resolve) => {
//       resolve({
//         json: () =>
//           Promise.resolve({
//             data,
//           }),
//       })
//     })
//   }
// }

// global.fetch = jest.fn().mockImplementation(setupFetchStub(fakeData))

test('test ctor', () => {
  const logger = tester.createMockIntegrationLogger();
  const client = new APIClient(logger);
  expect(client).toBeDefined();
});

// test('it returns 200 status', async () => {
//   const client = createClient();

//   const testUrl = "http://localhost";
//   const response = await client.executeAuthenticatedAPIRequest<ResourcesResponse<any>>(testUrl, {
//           method: 'GET',
//           headers: {
//             accept: 'application/json',
//           },
//         });
//   // expect(response).toEqual(fakeData);
//   expect(global.fetch).toHaveBeenCalled();
// });