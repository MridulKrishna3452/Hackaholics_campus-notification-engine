import { Injectable } from '@nestjs/common';
import { EnforceEnvOrOrgIds } from '../../types';
import { BaseRepositoryV2 } from '../base-repository-v2';
import { FocusSessionDBModel, FocusSessionEntity } from './focus-session.entity';
import { FocusSession } from './focus-session.schema';

type Scope = { environmentId: string; organizationId: string; subscriberId: string };

/**
 * INTERFACE FROM PERSON 1 -> PERSON 2. Do not rename or change signatures without telling Person 2:
 *   findActive(scope, now?)  -> the open, unexpired session or null   (worker hot path)
 *   findLatest(scope)        -> most recently started session or null
 *   findOwned(scope, id)     -> a session by id, only if it belongs to the subscriber
 */
@Injectable()
export class FocusSessionRepository extends BaseRepositoryV2<
  FocusSessionDBModel,
  FocusSessionEntity,
  EnforceEnvOrOrgIds
> {
  constructor() {
    super(FocusSession, FocusSessionEntity);
  }

  async findActive(scope: Scope, now: Date = new Date()): Promise<FocusSessionEntity | null> {
    return this.findOne(
      {
        _environmentId: scope.environmentId,
        _organizationId: scope.organizationId,
        _subscriberId: scope.subscriberId,
        open: true,
        endsAt: { $gt: now },
      },
      '*'
    );
  }

  async findLatest(scope: Scope): Promise<FocusSessionEntity | null> {
    const [latest] = await this.find(
      {
        _environmentId: scope.environmentId,
        _organizationId: scope.organizationId,
        _subscriberId: scope.subscriberId,
      },
      '*',
      { sort: { startedAt: -1 }, limit: 1 }
    );

    return latest ?? null;
  }

  async findOwned(scope: Scope, sessionId: string): Promise<FocusSessionEntity | null> {
    return this.findOne(
      {
        _id: sessionId,
        _environmentId: scope.environmentId,
        _organizationId: scope.organizationId,
        _subscriberId: scope.subscriberId,
      },
      '*'
    );
  }

  /** Releases the "open" slot of sessions that ran out without being ended, so a new one can start. */
  async closeExpired(scope: Scope, now: Date = new Date()): Promise<void> {
    await this.update(
      {
        _environmentId: scope.environmentId,
        _organizationId: scope.organizationId,
        _subscriberId: scope.subscriberId,
        open: true,
        endsAt: { $lte: now },
      },
      { $unset: { open: 1 } }
    );
  }

  /** Throws a Mongo duplicate-key error (code 11000) when an open session already exists. */
  async start(scope: Scope, startedAt: Date, endsAt: Date): Promise<FocusSessionEntity> {
    return this.create({
      _environmentId: scope.environmentId,
      _organizationId: scope.organizationId,
      _subscriberId: scope.subscriberId,
      startedAt,
      endsAt,
      open: true,
    });
  }

  /** Returns false if the session was no longer open (lost a race with another end call). */
  async end(scope: Scope, sessionId: string, endedAt: Date): Promise<boolean> {
    const { modified } = await this.updateOne(
      {
        _id: sessionId,
        _environmentId: scope.environmentId,
        _organizationId: scope.organizationId,
        _subscriberId: scope.subscriberId,
        open: true,
      },
      { $set: { endedAt }, $unset: { open: 1 } }
    );

    return modified === 1;
  }
}
