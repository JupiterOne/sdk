import { VizNode, VizEdge, VizOptions } from './types/viz';

/**
 * Creates the html for the viz template
 */
export function generateVizHTML(
  nodeDataSets: VizNode[],
  edgeDataSets: VizEdge[],
  options: VizOptions = { edges: { arrows: { to: { enabled: true } } } },
) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Integration SDK Graph</title>
    </head>
    <body style="height:100vh;width:100%">
        <div id="integration-graph" style="height:100vh;width:100%"></div>
        <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>
        <script type="text/javascript">
            var nodes = new vis.DataSet(${JSON.stringify(nodeDataSets)});
            var edges = new vis.DataSet(${JSON.stringify(edgeDataSets)});
            // create a network
            var container = document.getElementById("integration-graph");
            var data = {
              nodes: nodes,
              edges: edges
            };
            var options = ${JSON.stringify(options)};
            var network = new vis.Network(container, data, options);
          </script>
    </body>
    </html>`;
}
