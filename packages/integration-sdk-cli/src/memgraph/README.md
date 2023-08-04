# Memgraph JupiterOne CLI Command

## Installation

This command assumes you have three additional values stored in your local .env
file: NEO4J_URI NEO4J_USER NEO4J_PASSWORD

This can be used for uploading to local or remote Memgraph databases. For
easy access to a local Memgraph instance, you can launch one via a Memgraph provided
Docker image with the command:

```
docker run \
    -p 3000:3000 -p 7444:7444 -p 7687:7687 \
    -d \
    -v mg_lib:/var/lib/memgraph \
    -v mg_log:/var/log/memgraph \
    -v mg_etc:/etc/memgraph \
    memgraph/memgraph-platform
```

## Usage

Data is still collected in the same way as before with a call to `yarn start`.

Once data has been collected, you can run `j1-integration memgraph push`. This will
push data to the Memgraph server listed in the MEMGRAPH_URI .env parameter. If running
locally, you can then access data in the Memgraph database by visiting
http://localhost:3000. Alternatively, you can download Memgraph Lab at the 
https://memgraph.com/lab.
