# @jupiterone/integration-sdk-dev-tools

This package contains some common dependencies and configuration files used in
JupiterOne integrations.

This module is opinionated and bundles in the following dependencies:

- `typescript`
- `prettier`
- `jest`
- `eslint`
- `husky`
- `lint-staged`

For convenience, this package also comes bundled with the
`@jupiterone/integration-sdk-cli` module.

## Installation

```
npm install -D @jupiterone/integration-sdk-dev-tools

# or

yarn add -D @jupiterone/integration-sdk-dev-tools
```

## Usage

Create `prettier.config.js` at root of your project that contains:

```javascript
module.exports = require('@jupiterone/integration-sdk-dev-tools/config/prettier');
```

Create `lint-staged.config.js` at root of your project that contains:

```javascript
module.exports = require('@jupiterone/integration-sdk-dev-tools/config/lint-staged');
```

Create `.huskyrc.js` at root of your project that contains:

```javascript
module.exports = require('@jupiterone/integration-sdk-dev-tools/config/husky');
```

Create `jest.config.js` at root of your project that contains:

```javascript
module.exports = require('@jupiterone/integration-sdk-dev-tools/config/jest');
```

Create `tsconfig.json` at root of your project that contains:

```json
{
  "extends": "./node_modules/@jupiterone/integration-sdk-dev-tools/config/typescript"
}
```
