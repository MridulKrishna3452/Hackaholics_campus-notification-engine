import { ChannelTypeEnum, IConfigurations } from '@novu/shared';
import {
  ChannelProvider,
  IEmailEventBody,
  ISMSEventBody,
  IWebhookSignatureVerificationResult,
  WebhookSignatureStatusEnum,
} from '@novu/stateless';

export interface IHandler {
  inboundWebhookEnabled(): boolean;

  getMessageId: (body: unknown | unknown[]) => string[];

  parseEventBody: (
    body: unknown | unknown[],
    identifier: string,
    eventIndex?: number
  ) => IEmailEventBody | ISMSEventBody | undefined;

  /**
   * Fail-closed: resolves `success: true` only when the provider positively verified the
   * request signature (`status === VERIFIED`). Never throws.
   */
  verifySignature: ({
    body,
    headers,
    rawBody,
  }: {
    body: Record<string, unknown>;
    headers: Record<string, string>;
    rawBody: unknown;
  }) => Promise<IWebhookSignatureVerificationResult>;

  autoConfigureInboundWebhook: (configurations: { webhookUrl: string }) => Promise<{
    success: boolean;
    message?: string;
    configurations?: IConfigurations;
  }>;
}

export abstract class BaseHandler<T extends ChannelProvider = ChannelProvider> implements IHandler {
  protected provider: T;
  protected providerId: string;
  protected channelType: string;

  protected constructor(providerId?: string, channelType?: string) {
    this.providerId = providerId;
    this.channelType = channelType;
  }

  canHandle(providerId: string, channelType: ChannelTypeEnum): boolean {
    return providerId === this.providerId && channelType === this.channelType;
  }

  public getProvider(): T {
    return this.provider;
  }

  public inboundWebhookEnabled(): boolean {
    return !!(this.provider?.getMessageId && this.provider?.parseEventBody);
  }

  public getMessageId(body: unknown | unknown[]): string[] {
    if (!this.provider?.getMessageId) {
      return [];
    }

    return this.provider.getMessageId(body);
  }

  public parseEventBody(
    body: unknown | unknown[],
    identifier: string,
    eventIndex?: number
  ): IEmailEventBody | ISMSEventBody | undefined {
    if (!this.provider?.parseEventBody) {
      return undefined;
    }

    const result = this.provider.parseEventBody(body, identifier, eventIndex);

    return result && typeof result === 'object' ? (result as IEmailEventBody | ISMSEventBody) : undefined;
  }

  public async verifySignature({
    rawBody,
    headers,
    body,
  }: {
    rawBody: unknown;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }): Promise<IWebhookSignatureVerificationResult> {
    if (!this.provider?.verifySignature) {
      // Fail closed: a provider without a verifier can never produce a trusted webhook
      return {
        success: false,
        status: WebhookSignatureStatusEnum.UNSUPPORTED,
        message: 'Signature verification is not supported by this provider',
      };
    }

    try {
      const result = await this.provider.verifySignature({ rawBody, headers, body });

      return normalizeWebhookSignatureResult(result);
    } catch (error) {
      return {
        success: false,
        status: WebhookSignatureStatusEnum.ERROR,
        message: `Error verifying signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  public async autoConfigureInboundWebhook(configurations: { webhookUrl: string }): Promise<{
    success: boolean;
    message?: string;
    configurations?: IConfigurations;
  }> {
    if (!this.provider?.autoConfigureInboundWebhook) {
      return Promise.resolve({
        success: false,
        message:
          'A support of auto-configuration of inbound webhook is not implemented by provider, manual configuration is required',
      });
    }

    return this.provider.autoConfigureInboundWebhook(configurations);
  }
}

/**
 * Enforces the `IWebhookSignatureVerificationResult` invariant on whatever a provider returned:
 * only an explicit `success: true` without a contradicting status maps to VERIFIED.
 */
export function normalizeWebhookSignatureResult(result: unknown): IWebhookSignatureVerificationResult {
  if (!result || typeof result !== 'object' || typeof (result as { success?: unknown }).success !== 'boolean') {
    return {
      success: false,
      status: WebhookSignatureStatusEnum.ERROR,
      message: 'Provider returned an invalid signature verification result',
    };
  }

  const { success, status, message } = result as {
    success: boolean;
    status?: WebhookSignatureStatusEnum;
    message?: string;
  };

  if (success && (status === undefined || status === WebhookSignatureStatusEnum.VERIFIED)) {
    return { success: true, status: WebhookSignatureStatusEnum.VERIFIED, message };
  }

  const isKnownFailureStatus =
    status !== undefined &&
    status !== WebhookSignatureStatusEnum.VERIFIED &&
    Object.values(WebhookSignatureStatusEnum).includes(status);

  return {
    success: false,
    status: isKnownFailureStatus ? status : WebhookSignatureStatusEnum.INVALID,
    message,
  };
}
