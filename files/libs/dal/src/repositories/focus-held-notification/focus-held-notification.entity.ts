import { ChangePropsValueType } from '../../types/helpers';
import { EnvironmentId } from '../environment';
import { OrganizationId } from '../organization';

/**
 * A notification that was held (not delivered) because its subscriber was in Focus Mode.
 * One row per (focus session, notification) — a workflow with several channel steps still yields ONE row.
 */
export class FocusHeldNotificationEntity {
  _id: string;

  _environmentId: EnvironmentId;

  _organizationId: OrganizationId;

  /** Subscriber database _id. */
  _subscriberId: string;

  /** FocusSession._id owned by Person 1. */
  _focusSessionId: string;

  _notificationId: string;

  transactionId: string;

  /** Workflow trigger identifier (job.identifier). */
  workflowIdentifier: string;

  /** Optional caller-supplied correlation key (payload.entityKey). Absent => never merged with others. */
  entityKey?: string;

  /** Step types that were held for this notification, e.g. ['email','push']. */
  stepTypes: string[];

  heldAt: Date;

  createdAt: string;

  updatedAt: string;
}

export type FocusHeldNotificationDBModel = ChangePropsValueType<
  FocusHeldNotificationEntity,
  '_environmentId' | '_organizationId' | '_subscriberId' | '_focusSessionId' | '_notificationId'
>;
