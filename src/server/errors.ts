/** An error whose message is safe to show to the user. Raw provider output never goes in here. */
export class PublicError extends Error {
  constructor(public code: string, message: string, public status = 502) { super(message); }
}
