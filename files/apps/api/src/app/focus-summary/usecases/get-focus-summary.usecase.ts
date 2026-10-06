import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  FOCUS_SUMMARY_MAX_ITEMS,
  FocusHeldNotificationRepository,
  FocusSessionRepository,
  SubscriberRepository,
} from '@novu/dal';
import { FocusSummaryResponseDto } from '../dtos/focus-summary.dto';
import { buildFocusSummaryGroups } from './build-focus-summary';

@Injectable()
export class GetFocusSummary {
  constructor(
    private focusSessionRepository: FocusSessionRepository,
    private focusHeldNotificationRepository: FocusHeldNotificationRepository,
    private subscriberRepository: SubscriberRepository
  ) {}

  /** Read-only and repeatable: calling it twice returns the same summary. */
  async execute(command: {
    environmentId: string;
    organizationId: string;
    subscriberId: string; // external id from the JWT
    sessionId?: string;
  }): Promise<FocusSummaryResponseDto> {
    const subscriber = await this.subscriberRepository.findBySubscriberId(
      command.environmentId,
      command.subscriberId,
      false,
      '_id'
    );
    if (!subscriber) {
      throw new BadRequestException(`Subscriber with id: ${command.subscriberId} is not found.`);
    }

    const scope = {
      environmentId: command.environmentId,
      organizationId: command.organizationId,
      subscriberId: subscriber._id,
    };

    // Ownership is enforced by the scope: a session id of another student simply is not found.
    const session = command.sessionId
      ? await this.focusSessionRepository.findOwned(scope, command.sessionId)
      : await this.focusSessionRepository.findLatest(scope);
    if (!session) {
      throw new NotFoundException('Focus session not found');
    }

    if (session.open && session.endsAt.getTime() > Date.now()) {
      throw new ConflictException('Focus mode is still active; the summary is available once it ends');
    }

    const items = await this.focusHeldNotificationRepository.findForSession({
      ...scope,
      focusSessionId: session._id,
    });
    const groups = buildFocusSummaryGroups(items);

    return {
      sessionId: session._id,
      startedAt: session.startedAt.toISOString(),
      endedAt: (session.endedAt ?? session.endsAt).toISOString(),
      totalHeld: items.length,
      totalGroups: groups.length,
      truncated: items.length >= FOCUS_SUMMARY_MAX_ITEMS,
      groups,
    };
  }
}
