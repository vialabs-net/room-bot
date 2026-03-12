import Anthropic from '@anthropic-ai/sdk';
import { childLogger } from '../utils/logger.js';

const log = childLogger('ai-client');

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 600;
const MAX_RETRIES = 3;

export async function generateMessage(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const block = response.content[0];
      if (!block || block.type !== 'text') {
        throw new Error('Claude returned no text content');
      }

      log.info({
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      }, 'ai.generation.complete');

      return block.text.trim();
    } catch (err) {
      if (isNonRetriable(err)) {
        log.error({ err: String(err) }, 'ai.generation.failed.non_retriable');
        throw err;
      }
      if (attempt === MAX_RETRIES) {
        log.error({ err: String(err), attempt }, 'ai.generation.failed.max_retries');
        throw err;
      }
      const delay = 1000 * Math.pow(2, attempt - 1);
      log.warn({ err: String(err), attempt, delay }, 'ai.generation.retry');
      await sleep(delay);
    }
  }

  throw new Error('Unreachable');
}

function isNonRetriable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
