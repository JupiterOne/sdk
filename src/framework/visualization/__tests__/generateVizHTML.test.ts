import { generateVizHTML } from '../generateVizHTML';
import { VizNode, VizEdge } from '../types/viz';

const nodeDataSets: VizNode[] = [
  { id: '1', label: 'Node 1' },
  { id: '2', label: 'Node 2' },
  { id: '3', label: 'Node 3' },
];

const edgeDataSet: VizEdge[] = [
  { from: '1', to: '2' },
  { from: '2', to: '3' },
  { from: '3', to: '1' },
];

test('renders html with default config', () => {
  const html = generateVizHTML(nodeDataSets, edgeDataSet);

  expect(html).toContain(
    'var options = {"edges":{"arrows":{"to":{"enabled":true}}}}',
  );
  expect(html).toMatchSnapshot();
});

test('renders custom config when passed in', () => {
  const html = generateVizHTML(nodeDataSets, edgeDataSet, {});

  expect(html).toContain('var options = {}');
  expect(html).toMatchSnapshot();
});
