# Neo4j JupiterOne CLI Command

## Installation

This command assumes you have three additional values stored in your local .env
file: NEO4J_URI NEO4J_USER NEO4J_PASSWORD

This can be used for uploading to local or remote Neo4j databases. If SSL is
needed for a remote connection, specify `bolt+s` or `bolt+ssc` in the URI. For
easy access to a local Neo4j instance, you can launch one via a Neo4j provided
Docker image with the command:

```
docker run \
    -p 7474:7474 -p 7687:7687 \
    -d \
    -v $PWD/.neo4j/data:/data \
    -v $PWD/.neo4j/logs:/logs \
    -v $PWD/.neo4j/import:/var/lib/neo4j/import \
    -v $PWD/.neo4j/plugins:/plugins \
    --env NEO4J_AUTH=neo4j/devpass \
    neo4j:latest
```

If you would like to use a different username and password, the NEO4J_AUTH value
can be modified to whatever username/password you prefer.

NOTE: Future updates are planned to streamline this without removing the option
of pushing to an external Neo4j database.

## Usage

Data is still collected in the same way as before with a call to
`npm run start`.

Once data has been collected, you can run `j1-integration neo4j push`. This will
push data to the Neo4j server listed in the NEO4J_URI .env parameter. If running
locally, you can then access data in the Neo4j database by visiting
http://localhost:7474. Alternatively, you can download the full Neo4j Desktop
application at https://neo4j.com/download/.
