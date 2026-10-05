import { Injectable, NotFoundException } from '@nestjs/common';
import { FocusSessionRepository, SubscriberRepository } from '@novu/dal';
import { FocusModeStatusResponseDto, toFocusModeStatus } from '../dtos/focus-mode.dto';
import { FocusModeCommand } from './focus-mode.command';
import { resolveFocusScope } from './resolve-focus-scope';

@Injectable()
export class EndFocusMode {
  constructor(
    private focusSessionRepository: FocusSessionRepository,
    private subscriberRepository: SubscriberRepository
  ) {}

  /**
   * Ends the active session. The response carries the `sessionId`; the client then calls Person 2's
   * `GET /v1/inbox/focus-mode/summary?sessionId=...` to fetch the catch-up summary.
   */
  async execute(command: FocusModeCommand): Promise<FocusModeStatusResponseDto> {
    const scope = await resolveFocusScope(this.subscriberRepository, command);
    const now = new Date();

    const active = await this.focusSessionRepository.findActive(scope, now);
    if (!active) {
      throw new NotFoundException('No active focus session');
    }

    const ended = await this.focusSessionRepository.end(scope, active._id, now);
    if (!ended) {
      throw new NotFoundException('No active focus session');
    }

    const session = await this.focusSessionRepository.findOwned(scope, active._id);

    return toFocusModeStatus(session, now);
  }
}
