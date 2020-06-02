import noop from 'lodash/noop';

// this fixture helps ensure that the
// invocation config is read correctly
export default {
  instanceConfigFields: require('./instanceConfigFields'),
  validateInvocation: noop,
};
