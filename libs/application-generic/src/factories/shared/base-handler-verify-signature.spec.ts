import { ChannelTypeEnum } from '@novu/shared';
import { ChannelProvider, WebhookSignatureStatusEnum } from '@novu/stateless';
import { expect } from 'chai';

import { BaseHandler, normalizeWebhookSignatureResult } from './interfaces';

class TestHandler extends BaseHandler {
  constructor(provider?: Partial<ChannelProvider>) {
    super('test-provider', ChannelTypeEnum.EMAIL);
    this.provider = provider as ChannelProvider;
  }
}

const request = { rawBody: '{}', headers: {}, body: {} };

describe('BaseHandler.verifySignature (fail-closed)', () => {
  it('rejects with UNSUPPORTED when the provider has no verifier', async () => {
    const result = await new TestHandler({}).verifySignature(request);

    expect(result.success).to.equal(false);
    expect(result.status).to.equal(WebhookSignatureStatusEnum.UNSUPPORTED);
  });

  it('rejects with UNSUPPORTED when no provider was built', async () => {
    const result = await new TestHandler(undefined).verifySignature(request);

    expect(result.success).to.equal(false);
    expect(result.status).to.equal(WebhookSignatureStatusEnum.UNSUPPORTED);
  });

  it('accepts only when the provider reports success', async () => {
    const result = await new TestHandler({
      verifySignature: async () => ({ success: true, status: WebhookSignatureStatusEnum.VERIFIED }),
    }).verifySignature(request);

    expect(result.success).to.equal(true);
    expect(result.status).to.equal(WebhookSignatureStatusEnum.VERIFIED);
  });

  it('rejects with ERROR when the provider throws', async () => {
    const result = await new TestHandler({
      verifySignature: async () => {
        throw new Error('boom');
      },
    }).verifySignature(request);

    expect(result.success).to.equal(false);
    expect(result.status).to.equal(WebhookSignatureStatusEnum.ERROR);
  });

  it('passes rawBody, headers and body through unchanged', async () => {
    let received: unknown;
    const rawBody = Buffer.from('[{"event":"delivered"}]');
    const headers = { 'x-test': '1' };

    await new TestHandler({
      verifySignature: async (params) => {
        received = params;

        return { success: true };
      },
    }).verifySignature({ rawBody, headers, body: { a: 1 } });

    expect(received).to.deep.equal({ rawBody, headers, body: { a: 1 } });
  });
});

describe('normalizeWebhookSignatureResult', () => {
  it('maps legacy { success: true } to VERIFIED', () => {
    expect(normalizeWebhookSignatureResult({ success: true })).to.deep.include({
      success: true,
      status: WebhookSignatureStatusEnum.VERIFIED,
    });
  });

  it('maps legacy { success: false } to INVALID', () => {
    expect(normalizeWebhookSignatureResult({ success: false })).to.deep.include({
      success: false,
      status: WebhookSignatureStatusEnum.INVALID,
    });
  });

  it('never reports success when a non-VERIFIED status accompanies success: true', () => {
    const result = normalizeWebhookSignatureResult({
      success: true,
      status: WebhookSignatureStatusEnum.NOT_CONFIGURED,
    });

    expect(result.success).to.equal(false);
    expect(result.status).to.equal(WebhookSignatureStatusEnum.NOT_CONFIGURED);
  });

  it('downgrades success: false with status VERIFIED to INVALID', () => {
    const result = normalizeWebhookSignatureResult({ success: false, status: WebhookSignatureStatusEnum.VERIFIED });

    expect(result).to.deep.include({ success: false, status: WebhookSignatureStatusEnum.INVALID });
  });

  it('treats malformed results as ERROR', () => {
    for (const value of [undefined, null, 'ok', true, {}, { success: 'true' }]) {
      expect(normalizeWebhookSignatureResult(value)).to.deep.include({
        success: false,
        status: WebhookSignatureStatusEnum.ERROR,
      });
    }
  });
});
