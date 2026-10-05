export enum CheckIntegrationResponseEnum {
  INVALID_EMAIL = 'invalid_email',
  BAD_CREDENTIALS = 'bad_credentials',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Outcome of verifying an inbound provider webhook. Only VERIFIED means the
 * request may be trusted; every other value must be rejected by the caller.
 */
export enum WebhookSignatureStatusEnum {
  /** Signature present and valid for the configured key. */
  VERIFIED = 'verified',
  /** Signature present but does not match the payload/key. */
  INVALID = 'invalid',
  /** Provider supports signing, but the request carries no signature. */
  MISSING_SIGNATURE = 'missing_signature',
  /** Provider supports signing, but the integration has no signing/verification key configured. */
  NOT_CONFIGURED = 'not_configured',
  /** Provider has no signature verification implementation. */
  UNSUPPORTED = 'unsupported',
  /** Verification could not complete (e.g. raw body unavailable, malformed key, unexpected exception). */
  ERROR = 'error',
}
