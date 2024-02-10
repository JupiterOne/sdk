FROM node:18-bullseye-slim as builder

ENV JUPITERONE_INTEGRATION_DIR=/opt/jupiterone/integration

COPY package.json yarn.lock tsconfig.dist.json tsconfig.json LICENSE ${JUPITERONE_INTEGRATION_DIR}/
COPY src/ ${JUPITERONE_INTEGRATION_DIR}/src
WORKDIR  ${JUPITERONE_INTEGRATION_DIR}
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/api/lists/*
RUN yarn install
RUN yarn build:docker


FROM node:18-bullseye-slim
ENV JUPITERONE_INTEGRATION_DIR=/opt/jupiterone/integration
COPY --from=builder --chown=node:node ${JUPITERONE_INTEGRATION_DIR}/dist ${JUPITERONE_INTEGRATION_DIR}
COPY --from=builder --chown=node:node ${JUPITERONE_INTEGRATION_DIR}/yarn.lock ${JUPITERONE_INTEGRATION_DIR}
COPY scripts/ ${JUPITERONE_INTEGRATION_DIR}/scripts
WORKDIR ${JUPITERONE_INTEGRATION_DIR}
RUN apt-get update && apt-get install -y python3
RUN yarn install --production --fronzen-lockfile --cache-folder ./ycache && yarn global add --cache-folder ./ycache @jupiterone/integration-sdk-cli && rm -rf ./ycache  && chown -R node:node /opt/jupiterone
RUN export PATH="$(yarn global bin):$PATH"

USER node

CMD ["sh", "scripts/execute.sh"]
