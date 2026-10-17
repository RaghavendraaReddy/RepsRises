import { checkReply, replySchema, type CoachReply, type CoachRequest } from '../../shared/coach/contracts.js';
import { wireSchema } from '../../shared/schema.js';
import { PublicError } from '../errors.js';
import { contextBlock } from '../prompt.js';

export type OpenAIConfig = { key: string; model: string };

export function openaiPayload(request: CoachRequest, instructions: string, model: string) {
  return {
    model, store: false, max_output_tokens: 8000, instructions,
    input: [...request.messages.slice(0, -1), { role: 'user', content: `${contextBlock(request)}\n\n${request.messages.at(-1)!.content}` }],
    text: { format: { type: 'json_schema', name: 'coach_reply', strict: true, schema: wireSchema(replySchema) } },
  };
}

/** OpenAI Responses API with a strict JSON schema. Provider error bodies are never passed on. */
export async function openaiTurn(request: CoachRequest, instructions: string, config: OpenAIConfig, signal: AbortSignal, transport: typeof fetch = fetch): Promise<{ reply: CoachReply; returnedModel: string | null }> {
  let response: Response;
  try {
    response = await transport('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
      body: JSON.stringify(openaiPayload(request, instructions, config.model)), signal,
    });
  } catch {
    if (signal.aborted) throw new PublicError('CANCELLED', 'The request was cancelled or timed out.', 408);
    throw new PublicError('NETWORK', 'Could not reach OpenAI. Check the server’s internet connection.');
  }
  if (!response.ok) {
    const message = response.status === 401 ? 'OpenAI rejected the API key. Check OPENAI_API_KEY in .env.'
      : response.status === 404 ? `The model "${config.model}" is not available to this OpenAI account. Check OPENAI_MODEL.`
      : response.status === 429 ? 'OpenAI rate or usage limit reached. Check your account, or try again shortly.'
      : 'OpenAI could not complete the request. Try again, or switch coach.';
    throw new PublicError('PROVIDER', message, response.status === 429 ? 429 : 502);
  }
  let data: { status?: string; model?: string; output?: { type: string; content?: { type: string; text?: string }[] }[] };
  try { data = await response.json() as typeof data; } catch { throw new PublicError('SCHEMA', 'OpenAI returned unreadable data. Try again.'); }
  if (data.status !== 'completed') throw new PublicError('INCOMPLETE', 'The answer was cut off before it finished. Try again or ask for less.');
  const content = (data.output ?? []).filter(item => item.type === 'message').flatMap(item => item.content ?? []);
  if (content.some(item => item.type === 'refusal')) throw new PublicError('REFUSAL', 'The model declined that request. Try rephrasing it.');
  let value: unknown;
  try { value = JSON.parse(content.filter(item => item.type === 'output_text').map(item => item.text ?? '').join('')); }
  catch { throw new PublicError('SCHEMA', 'The answer was not in the expected format. Try again.'); }
  try { return { reply: checkReply(value), returnedModel: typeof data.model === 'string' ? data.model : null }; }
  catch (error) { throw new PublicError('SCHEMA', error instanceof Error ? error.message : 'Invalid coach reply.'); }
}
