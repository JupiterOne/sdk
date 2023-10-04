import type { Edge, Node } from 'vis';

import {
  generateVisHTML,
  nothingToDisplayMessage,
} from '../../utils/generateVisHTML';

const nodeDataSets: Node[] = [
  { id: '1', label: 'Node 1' },
  { id: '2', label: 'Node 2' },
  { id: '3', label: 'Node 3' },
];

const edgeDataSet: Edge[] = [
  { from: '1', to: '2' },
  { from: '2', to: '3' },
  { from: '3', to: '1' },
];

test('renders html with default config', () => {
  const html = generateVisHTML('path/to/data', nodeDataSets, edgeDataSet);

  expect(html).toContain(
    'var options = {"edges":{"arrows":{"to":{"enabled":true}}},"physics":{"barnesHut":{"springLength":300,"centralGravity":0.03}}}',
  );
  expect(html).toMatchSnapshot();
});

test('renders custom config when passed in', () => {
  const html = generateVisHTML('path/to/data', nodeDataSets, edgeDataSet, {
    edges: { color: '#ffffff' },
  });

  expect(html).toContain('"color":"#ffffff"');
  expect(html).toMatchSnapshot();
});

test('renders nothing to display message when there is nothing to display', () => {
  const html = generateVisHTML('path/to/data', [], []);

  expect(html).toContain(nothingToDisplayMessage);
  expect(html).toMatchSnapshot();
});
