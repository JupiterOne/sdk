import { fs } from 'memfs';
export const promises = fs.promises;

export const readdirSync = jest.requireActual('fs').readdirSync;
