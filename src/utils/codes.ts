import { randomBytes } from 'node:crypto';

export const generateTrackingCode = async (): Promise<string> => {
    return `BR${randomBytes(10).toString('hex').toUpperCase()}`;
}