import {
  setupRecording,
  Recording,
  SetupRecordingInput,
  mutations,
} from '@jupiterone/integration-sdk-testing';

export { Recording };

export function setupProjectRecording(
  input: Omit<SetupRecordingInput, 'mutateEntry'>,
): Recording {
  return setupRecording({
    ...input,
    redactedRequestHeaders: ['Authorization'],
    redactedResponseHeaders: ['set-cookie'],
    mutateEntry: mutations.unzipGzippedRecordingEntry,
    /*mutateEntry: (entry) => {
      redact(entry);
    },*/
  });
}

// a more sophisticated redaction example below:

/*
function getRedactedOAuthResponse() {
  return {
    access_token: '[REDACTED]',
    expires_in: 9999,
    token_type: 'Bearer',
  };
}

function redact(entry): void {
  if (entry.request.postData) {
    entry.request.postData.text = '[REDACTED]';
  }

  if (!entry.response.content.text) {
    return;
  }

  //let's unzip the entry so we can modify it
  mutations.unzipGzippedRecordingEntry(entry);

  //we can just get rid of all response content if this was the token call
  const requestUrl = entry.request.url;
  if (requestUrl.match(/oauth\/token/)) {
    entry.response.content.text = JSON.stringify(getRedactedOAuthResponse());
    return;
  }

  //if it wasn't a token call, parse the response text, removing any carriage returns or newlines
  const responseText = entry.response.content.text;
  const parsedResponseText = JSON.parse(responseText.replace(/\r?\n|\r/g, ''));

  //now we can modify the returned object as desired
  //in this example, if the return text is an array of objects that have the 'tenant' property...
  if (parsedResponseText[0]?.tenant) {
    for (let i = 0; i < parsedResponseText.length; i++) {
      parsedResponseText[i].client_secret = '[REDACTED]';
      parsedResponseText[i].jwt_configuration = '[REDACTED]';
      parsedResponseText[i].signing_keys = '[REDACTED]';
      parsedResponseText[i].encryption_key = '[REDACTED]';
      parsedResponseText[i].addons = '[REDACTED]';
      parsedResponseText[i].client_metadata = '[REDACTED]';
      parsedResponseText[i].mobile = '[REDACTED]';
      parsedResponseText[i].native_social_login = '[REDACTED]';
    }
  }

  entry.response.content.text = JSON.stringify(parsedResponseText);
} */
