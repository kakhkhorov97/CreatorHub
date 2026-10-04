import { createHash, randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(32).toString('hex');

export const tokenHash = (raw: string) => createHash('sha256').update(raw).digest('hex');
