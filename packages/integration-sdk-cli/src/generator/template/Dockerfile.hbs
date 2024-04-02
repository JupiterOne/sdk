FROM node:18-alpine

ENV JUPITERONE_INTEGRATION_DIR=/opt/jupiterone/integration

COPY package.json yarn.lock tsconfig.json LICENSE ${JUPITERONE_INTEGRATION_DIR}/
COPY src/ ${JUPITERONE_INTEGRATION_DIR}/src

WORKDIR ${JUPITERONE_INTEGRATION_DIR}
RUN yarn install

ENTRYPOINT /usr/local/bin/yarn --silent j1-integration run -i ${INTEGRATION_INSTANCE_ID} --disable-schema-validation --api-base-url ${JUPITERONE_API_BASE_URL:-https://api.us.jupiterone.io} --account ${JUPITERONE_ACCOUNT} --api-key ${JUPITERONE_API_KEY}
