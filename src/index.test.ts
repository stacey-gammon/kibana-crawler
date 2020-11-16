import { extractValues , extractVersionNumber, extractIssueNumber } from './utils';
import { getKibanaRelativePath, getTeamOwner } from './plugin_utils';

it('extractValue', () => {
  const themes = extractValues([{ name: 'Dependency:SIEM' }, { name: 'Feature:Bi hoo' }], 'Feature');
  expect(themes).toEqual(['Bi hoo']);
})

it('extractIssueNumber', () => {
  const num = extractIssueNumber(
    'https://api.github.com/repos/elastic/kibana/issues/75780');
  expect(num).toEqual('75780');
})

it('extractVersionNumber', () => {
  const version = extractVersionNumber('Target: 7.9');
  expect(version).toEqual('7.9');

  expect(extractVersionNumber('Target: 7.')).toEqual(undefined);

  expect(extractVersionNumber('8.0')).toEqual('8.0');


  expect(extractVersionNumber('7.14 - tentative')).toEqual('7.14');
})

it('getTeamOwner', () => {
  const owner = getTeamOwner('/blah/x-pack/legacy/plugins/beats_management/mm', [
    { path: '/x-pack/legacy/plugins/beats_management/', name: 'beats_management', teamOwner: 'beats', missingReadme: 0 }]);
  expect(owner).toBe('beats');
});

it('getKibanaRelativePath', () => {
  expect(getKibanaRelativePath('/Users/gammon/Elastic/kibana/examples/embeddable_examples/public/book/book_embeddable_factory.tsx'))
    .toBe('kibana/examples/embeddable_examples/public/book/book_embeddable_factory.tsx')
});

// it('extractPluginName', () => {
//   expect(extractPluginNameAndPath('/x-pack/plugins/apm/asdjfklsa')!.pluginPath).toEqual('/x-pack/plugins/apm');
//   expect(extractPluginNameAndPath('/x-pack/plugins/apm/asdjfklsa')!.pluginName).toEqual('apm');
//   expect(extractPluginNameAndPath('/x-pack/plugins/apm')!.pluginName).toEqual('apm');
//   expect(extractPluginNameAndPath('/x-pack/plugins/apm')!.pluginPath).toEqual('/x-pack/plugins/apm');
// });