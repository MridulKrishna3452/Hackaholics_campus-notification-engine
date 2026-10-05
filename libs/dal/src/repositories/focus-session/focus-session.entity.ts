import { ChangePropsValueType } from '../../types/helpers';
import { EnvironmentId } from '../environment';
import { OrganizationId } from '../organization';

/**
 * One Focus Mode period of one subscriber (student).
 *
 * Lifecycle:
 *  - active   : `open === true` and `endsAt > now`
 *  - expired  : `open === true` and `endsAt <= now` (never explicitly ended; treated as inactive everywhere)
 *  - ended    : `open` unset and `endedAt` set (student ended it early)
 *
 * `open` exists only so a partial unique index can guarantee at most one open session per subscriber.
 */
export class FocusSessionEntity {
  _id: string;

  _environmentId: EnvironmentId;

  _organizationId: OrganizationId;

  /** Subscriber database _id (NOT the external subscriberId string). */
  _subscriberId: string;

  startedAt: Date;

  endsAt: Date;

  /** Set only when the student ends the session before `endsAt`. */
  endedAt?: Date;

  /** true while the session is open; unset once ended or swept as expired. */
  open?: boolean;

  createdAt: string;

  updatedAt: string;
}

export type FocusSessionDBModel = ChangePropsValueType<
  FocusSessionEntity,
  '_environmentId' | '_organizationId' | '_subscriberId'
>;
