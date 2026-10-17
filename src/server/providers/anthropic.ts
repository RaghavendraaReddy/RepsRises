import Anthropic from '@anthropic-ai/sdk';
import { checkReply, replySchema, type CoachReply, type CoachRequest } from '../../shared/coach/contracts.js';
import { wireSchema } from '../../shared/schema.js';
import { PublicError } from '../errors.js';
import { contextBlock } from '../prompt.js';

export type AnthropicConfig = { key: string; model: string };
export type AnthropicClient = Pick<Anthropic, 'beta'>;

export function anthropicParams(request: CoachRequest, instructions: string, model: string): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const history: Anthropic.Beta.BetaMessageParam[] = request.messages.slice(0, -1).map(message => ({ role: message.role, content: message.content }));
  return {
    model,
    max_tokens: 16000,
    // Server-side fallback: if the model declines for policy reasons, the API retries on its default fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    // The instructions never change between turns, so they are cached.
    system: [{ type: 'text', text: instructions, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: wireSchema(replySchema) as Record<string, unknown> } },
    messages: [...history, { role: 'user', content: [{ type: 'text', text: contextBlock(request) }, { type: 'text', text: request.messages.at(-1)!.content }] }],
  };
}

/** Claude through the official Anthropic SDK with structured output. */
export async function anthropicTurn(request: CoachRequest, instructions: string, config: AnthropicConfig, signal: AbortSignal, client?: AnthropicClient): Promise<{ reply: CoachReply; returnedModel: string | null }> {
  const api = client ?? new Anthropic({ apiKey: config.key, maxRetries: 1, timeout: 85_000 });
  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await api.beta.messages.create(anthropicParams(request, instructions, config.model), { signal });
  } catch (error) {
    if (signal.aborted || error instanceof Anthropic.APIUserAbortError) throw new PublicError('CANCELLED', 'The request was cancelled or timed out.', 408);
    if (error instanceof Anthropic.AuthenticationError) throw new PublicError('PROVIDER', 'Anthropic rejected the API key. Check ANTHROPIC_API_KEY in .env.', 502);
    if (error instanceof Anthropic.NotFoundError) throw new PublicError('PROVIDER', `The model "${config.model}" is not available to this account. Check ANTHROPIC_MODEL.`, 502);
    if (error instanceof Anthropic.RateLimitError) throw new PublicError('PROVIDER', 'Anthropic rate or usage limit reached. Try again shortly.', 429);
    if (error instanceof Anthropic.BadRequestError) throw new PublicError('PROVIDER', 'Anthropic rejected the request. Check ANTHROPIC_MODEL supports structured output.', 502);
    if (error instanceof Anthropic.APIConnectionError) throw new PublicError('NETWORK', 'Could not reach Anthropic. Check the server’s internet connection.');
    throw new PublicError('PROVIDER', 'Anthropic could not complete the request. Try again, or switch coach.');
  }
  if (response.stop_reason === 'refusal') throw new PublicError('REFUSAL', 'The model declined that request. Try rephrasing it.');
  if (response.stop_reason === 'max_tokens') throw new PublicError('INCOMPLETE', 'The answer was cut off before it finished. Ask for less and try again.');
  const text = response.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new PublicError('SCHEMA', 'The answer was not in the expected format. Try again.'); }
  try { return { reply: checkReply(value), returnedModel: response.model ?? null }; }
  catch (error) { throw new PublicError('SCHEMA', error instanceof Error ? error.message : 'Invalid coach reply.'); }
}
