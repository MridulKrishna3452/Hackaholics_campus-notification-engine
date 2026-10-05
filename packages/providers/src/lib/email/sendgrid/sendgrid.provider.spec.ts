import { generateKeyPairSync, sign } from 'node:crypto';
import { EmailEventStatusEnum, WebhookSignatureStatusEnum } from '@novu/stateless';
import { Client } from '@sendgrid/client';
import { MailService } from '@sendgrid/mail';
import { describe, expect, test, vi } from 'vitest';
import { SendgridEmailProvider } from './sendgrid.provider';

const mockConfig = {
  apiKey: 'SG.1234',
  from: 'test@tet.com',
  senderName: 'test',
};

const mockNovuMessage = {
  to: ['test@test2.com'],
  subject: 'test subject',
  html: '<div> Mail Content </div>',
  from: 'test@tet.com',
  attachments: [{ mime: 'text/plain', file: Buffer.from('dGVzdA=='), name: 'test.txt' }],
  id: 'message_id',
};

test('should trigger sendgrid correctly', async () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const spy = vi.spyOn(MailService.prototype, 'send').mockImplementation(async () => {
    return {} as any;
  });

  await provider.sendMessage(mockNovuMessage);

  expect(spy).toHaveBeenCalled();
  expect(spy).toHaveBeenCalledWith({
    to: [
      {
        email: mockNovuMessage.to[0],
      },
    ],
    bcc: undefined,
    category: undefined,
    cc: undefined,
    subject: mockNovuMessage.subject,
    html: mockNovuMessage.html,
    ipPoolName: undefined,
    from: { email: mockNovuMessage.from, name: mockConfig.senderName },
    substitutions: {},
    attachments: [
      {
        type: 'text/plain',
        content: Buffer.from('ZEdWemRBPT0=').toString(),
        filename: 'test.txt',
      },
    ],
    customArgs: {
      id: 'message_id',
      novuMessageId: 'message_id',
      novuSubscriberId: undefined,
      novuTransactionId: undefined,
      novuWorkflowIdentifier: undefined,
    },
    personalizations: [
      {
        to: [
          {
            email: mockNovuMessage.to[0],
          },
        ],
        cc: undefined,
        bcc: undefined,
        dynamicTemplateData: undefined,
      },
    ],
    templateId: undefined,
  });
});

test('should trigger sendgrid correctly with _passthrough', async () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const spy = vi.spyOn(MailService.prototype, 'send').mockImplementation(async () => {
    return {} as any;
  });

  await provider.sendMessage(mockNovuMessage, {
    _passthrough: {
      body: {
        subject: 'test subject _passthrough',
      },
    },
  });

  expect(spy).toHaveBeenCalled();
  expect(spy).toHaveBeenCalledWith({
    to: [
      {
        email: mockNovuMessage.to[0],
      },
    ],
    bcc: undefined,
    category: undefined,
    cc: undefined,
    subject: 'test subject _passthrough',
    html: mockNovuMessage.html,
    ipPoolName: undefined,
    from: { email: mockNovuMessage.from, name: mockConfig.senderName },
    substitutions: {},
    attachments: [
      {
        type: 'text/plain',
        content: Buffer.from('ZEdWemRBPT0=').toString(),
        filename: 'test.txt',
      },
    ],
    customArgs: {
      id: 'message_id',
      novuMessageId: 'message_id',
      novuSubscriberId: undefined,
      novuTransactionId: undefined,
      novuWorkflowIdentifier: undefined,
    },
    personalizations: [
      {
        to: [
          {
            email: mockNovuMessage.to[0],
          },
        ],
        cc: undefined,
        bcc: undefined,
        dynamicTemplateData: undefined,
      },
    ],
    templateId: undefined,
  });
});

test('should send custom MIME alternatives in content array', async () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const spy = vi.spyOn(MailService.prototype, 'send').mockImplementation(async () => {
    return {} as any;
  });
  const reactionAlternative = {
    contentType: 'text/vnd.google.email-reaction+json',
    content: JSON.stringify({ version: 1, emoji: '👀' }),
  };

  await provider.sendMessage({
    ...mockNovuMessage,
    text: '👀',
    html: '<p>👀</p>',
    alternatives: [reactionAlternative],
  });

  const payload = spy.mock.calls[0][0] as unknown as Record<string, unknown>;
  expect(payload).not.toHaveProperty('html');
  expect(payload).toEqual(
    expect.objectContaining({
      content: [
        { type: 'text/plain', value: '👀' },
        { type: 'text/html', value: '<p>👀</p>' },
        {
          type: 'text/vnd.google.email-reaction+json',
          value: JSON.stringify({ version: 1, emoji: '👀' }),
        },
      ],
    })
  );
});

test('should check provider integration correctly', async () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const spy = vi.spyOn(MailService.prototype, 'send').mockImplementation(async () => {
    return [{ statusCode: 202 }] as any;
  });

  const response = await provider.checkIntegration(mockNovuMessage);
  expect(spy).toHaveBeenCalled();
  expect(response.success).toBe(true);
});

test('should get ip pool name from credentials', async () => {
  const provider = new SendgridEmailProvider({
    ...mockConfig,
    ...{ ipPoolName: 'config_ip' },
  });
  const sendMock = vi.fn().mockResolvedValue([{ statusCode: 202 }]);
  vi.spyOn(MailService.prototype, 'send').mockImplementation(sendMock);

  await provider.sendMessage({
    ...mockNovuMessage,
  });
  expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ ipPoolName: 'config_ip' }));
});

test('should override credentials with mail data', async () => {
  const provider = new SendgridEmailProvider({
    ...mockConfig,
    ...{ ipPoolName: 'config_ip' },
  });
  const sendMock = vi.fn().mockResolvedValue([{ statusCode: 202 }]);
  vi.spyOn(MailService.prototype, 'send').mockImplementation(sendMock);

  await provider.sendMessage({
    ...mockNovuMessage,
    ...{ ipPoolName: 'ip_from_mail_data' },
  });
  expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ ipPoolName: 'ip_from_mail_data' }));
});

test('should set EU data residency when region is eu', async () => {
  const setDataResidencySpy = vi.spyOn(Client.prototype, 'setDataResidency');

  new SendgridEmailProvider({
    ...mockConfig,
    region: 'eu',
  });

  expect(setDataResidencySpy).toHaveBeenCalledWith('eu');
});

test('should not set data residency when region is global', async () => {
  const setDataResidencySpy = vi.spyOn(Client.prototype, 'setDataResidency');
  setDataResidencySpy.mockClear();

  new SendgridEmailProvider({
    ...mockConfig,
    region: 'global',
  });

  expect(setDataResidencySpy).not.toHaveBeenCalled();
});

test('should not set data residency when region is not provided', async () => {
  const setDataResidencySpy = vi.spyOn(Client.prototype, 'setDataResidency');
  setDataResidencySpy.mockClear();

  new SendgridEmailProvider(mockConfig);

  expect(setDataResidencySpy).not.toHaveBeenCalled();
});

test('parseEventBody maps SendGrid blocked event to BLOCKED status', () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const externalId = 'sg-msg-blocked-1';

  const result = provider.parseEventBody(
    {
      id: externalId,
      event: 'blocked',
      attempt: '1',
      response: 'blocked by suppression',
    },
    externalId
  );

  expect(result).toEqual({
    status: EmailEventStatusEnum.BLOCKED,
    date: expect.any(String),
    externalId,
    attempts: 1,
    response: 'blocked by suppression',
    row: expect.any(String),
  });
});

test('parseEventBody processes each batched event by index when message ids repeat', () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const messageId = '6a4bdaeb6baa48da73d25308';
  const batch = [
    {
      id: messageId,
      event: 'delivered',
      response: '250 OK',
      attempt: '1',
    },
    {
      id: messageId,
      event: 'open',
      attempt: '1',
    },
  ];

  const delivered = provider.parseEventBody(batch, messageId, 0);
  const opened = provider.parseEventBody(batch, messageId, 1);

  expect(delivered?.status).toBe(EmailEventStatusEnum.DELIVERED);
  expect(opened?.status).toBe(EmailEventStatusEnum.OPENED);
});

test('parseEventBody falls back to identifier lookup when indexed event does not match', () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const batch = [
    {
      id: 'message-a',
      event: 'delivered',
    },
    {
      id: 'message-b',
      event: 'open',
    },
  ];

  const result = provider.parseEventBody(batch, 'message-b', 0);

  expect(result?.status).toBe(EmailEventStatusEnum.OPENED);
  expect(result?.externalId).toBe('message-b');
});

test('getMessageId returns one id per batched event including duplicates', () => {
  const provider = new SendgridEmailProvider(mockConfig);
  const messageId = '6a4bdaeb6baa48da73d25308';
  const batch = [
    { id: messageId, event: 'delivered' },
    { id: messageId, event: 'open' },
  ];

  expect(provider.getMessageId(batch)).toEqual([messageId, messageId]);
});

describe('verifySignature (SendGrid Signed Event Webhook)', () => {
  // SendGrid returns the verification key as a base64 DER (SPKI) P-256 public key
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const webhookPublicKey = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const rawBody = JSON.stringify([{ email: 'student@campus.edu', event: 'delivered', sg_message_id: 'abc.123' }]);
  const timestamp = '1700000000';
  const signPayload = (ts: string, payload: string) => sign('sha256', Buffer.from(ts + payload), privateKey).toString('base64');
  const signedHeaders = (payload = rawBody, ts = timestamp) => ({
    'X-Twilio-Email-Event-Webhook-Signature': signPayload(ts, payload),
    'X-Twilio-Email-Event-Webhook-Timestamp': ts,
  });
  const provider = new SendgridEmailProvider({ ...mockConfig, webhookPublicKey });

  test('accepts a valid signature over the raw string body', async () => {
    const result = await provider.verifySignature({ rawBody, headers: signedHeaders() });

    expect(result).toMatchObject({ success: true, status: WebhookSignatureStatusEnum.VERIFIED });
  });

  test('accepts a valid signature over a raw Buffer body with lower-cased headers', async () => {
    const headers = Object.fromEntries(Object.entries(signedHeaders()).map(([k, v]) => [k.toLowerCase(), v]));
    const result = await provider.verifySignature({ rawBody: Buffer.from(rawBody), headers });

    expect(result).toMatchObject({ success: true, status: WebhookSignatureStatusEnum.VERIFIED });
  });

  test('rejects a tampered body', async () => {
    const result = await provider.verifySignature({
      rawBody: rawBody.replace('delivered', 'bounce'),
      headers: signedHeaders(),
    });

    expect(result).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.INVALID });
  });

  test('rejects a tampered timestamp', async () => {
    const headers = { ...signedHeaders(), 'X-Twilio-Email-Event-Webhook-Timestamp': '1700000001' };
    const result = await provider.verifySignature({ rawBody, headers });

    expect(result).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.INVALID });
  });

  test('rejects a signature produced by a different key', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const forged = sign('sha256', Buffer.from(timestamp + rawBody), other.privateKey).toString('base64');
    const result = await provider.verifySignature({
      rawBody,
      headers: { ...signedHeaders(), 'X-Twilio-Email-Event-Webhook-Signature': forged },
    });

    expect(result).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.INVALID });
  });

  test('rejects a request without signature headers (previously accepted)', async () => {
    const result = await provider.verifySignature({ rawBody, headers: {} });

    expect(result).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.MISSING_SIGNATURE });
  });

  test('rejects when only one signature header is present', async () => {
    const { 'X-Twilio-Email-Event-Webhook-Timestamp': _ts, ...headers } = signedHeaders();
    const result = await provider.verifySignature({ rawBody, headers });

    expect(result).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.MISSING_SIGNATURE });
  });

  test('rejects when no verification key is configured, even if headers are present', async () => {
    const unconfigured = new SendgridEmailProvider(mockConfig);
    const result = await unconfigured.verifySignature({ rawBody, headers: signedHeaders() });

    expect(result).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.NOT_CONFIGURED });
  });

  test('rejects when the raw body is unavailable or already parsed', async () => {
    const missing = await provider.verifySignature({ rawBody: undefined, headers: signedHeaders() });
    const parsed = await provider.verifySignature({ rawBody: JSON.parse(rawBody), headers: signedHeaders() });

    expect(missing).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.ERROR });
    expect(parsed).toMatchObject({ success: false, status: WebhookSignatureStatusEnum.ERROR });
  });

  test('rejects (does not throw) when the configured key is malformed', async () => {
    const broken = new SendgridEmailProvider({ ...mockConfig, webhookPublicKey: 'not-a-key' });
    const result = await broken.verifySignature({ rawBody, headers: signedHeaders() });

    expect(result.success).toBe(false);
  });
});
