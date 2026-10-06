import { Injectable } from '@nestjs/common';
import { EnforceEnvOrOrgIds } from '../../types';
import { BaseRepositoryV2 } from '../base-repository-v2';
import { FocusHeldNotificationDBModel, FocusHeldNotificationEntity } from './focus-held-notification.entity';
import { FocusHeldNotification } from './focus-held-notification.schema';

const MONGO_DUPLICATE_KEY = 11000;
const MAX_SUMMARY_ITEMS = 1000;

export type RecordHeldParams = {
  environmentId: string;
  organizationId: string;
  subscriberId: string;
  focusSessionId: string;
  notificationId: string;
  transactionId: string;
  workflowIdentifier: string;
  entityKey?: string;
  stepType: string;
  heldAt: Date;
};

@Injectable()
export class FocusHeldNotificationRepository extends BaseRepositoryV2<
  FocusHeldNotificationDBModel,
  FocusHeldNotificationEntity,
  EnforceEnvOrOrgIds
> {
  constructor() {
    super(FocusHeldNotification, FocusHeldNotificationEntity);
  }

  /**
   * Idempotent: the first held step creates the row, later held steps of the same notification
   * (or a retried job) only add their step type. Never creates a duplicate row.
   */
  async recordHeld(params: RecordHeldParams): Promise<void> {
    const run = () =>
      this.MongooseModel.updateOne(
        {
          _environmentId: params.environmentId,
          _focusSessionId: params.focusSessionId,
          _notificationId: params.notificationId,
        },
        {
          $setOnInsert: {
            _organizationId: params.organizationId,
            _subscriberId: params.subscriberId,
            transactionId: params.transactionId,
            workflowIdentifier: params.workflowIdentifier,
            ...(params.entityKey ? { entityKey: params.entityKey } : {}),
            heldAt: params.heldAt,
          },
          $addToSet: { stepTypes: params.stepType },
        },
        { upsert: true }
      );

    try {
      await run();
    } catch (e) {
      // two workers upserting the same notification at once: the loser retries as a plain update
      if ((e as { code?: number })?.code !== MONGO_DUPLICATE_KEY) throw e;
      await run();
    }
  }

  /** Oldest first. Capped; callers must surface `truncated` if length === MAX_SUMMARY_ITEMS. */
  async findForSession(scope: {
    environmentId: string;
    organizationId: string;
    subscriberId: string;
    focusSessionId: string;
  }): Promise<FocusHeldNotificationEntity[]> {
    return this.find(
      {
        _environmentId: scope.environmentId,
        _organizationId: scope.organizationId,
        _subscriberId: scope.subscriberId,
        _focusSessionId: scope.focusSessionId,
      },
      '*',
      { sort: { heldAt: 1 }, limit: MAX_SUMMARY_ITEMS }
    );
  }
}

export const FOCUS_SUMMARY_MAX_ITEMS = MAX_SUMMARY_ITEMS;
