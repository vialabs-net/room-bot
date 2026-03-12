import pino from 'pino';

export const logger = pino({
  transport: process.env['NODE_ENV'] === 'production'
    ? undefined
    : { target: 'pino/file', options: { destination: 2 } },
});

export function childLogger(module: string) {
  return logger.child({ module });
}
