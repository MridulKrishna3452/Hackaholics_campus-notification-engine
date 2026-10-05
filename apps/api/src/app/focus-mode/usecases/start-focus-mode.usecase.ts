import { ConflictException, Injectable } from '@nestjs/common';
import { FocusSessionRepository, SubscriberRepository } from '@novu/dal';
import { FocusModeStatusResponseDto, toFocusModeStatus } from '../dtos/focus-mode.dto';
import { StartFocusModeCommand } from './focus-mode.command';
import { resolveFocusScope } from './resolve-focus-scope';

const MONGO_DUPLICATE_KEY = 11000;

@Injectable()
export class StartFocusMode {
  constructor(
    private focusSessionRepository: FocusSessionRepository,
    private subscriberRepository: SubscriberRepository
  ) {}

  async execute(command: StartFocusModeCommand): Promise<FocusModeStatusResponseDto> {
    const scope = await resolveFocusScope(this.subscriberRepository, command);
    const now = new Date();

    // Free the "open" slot of a session that silently ran out, so it does not block a new one.
    await this.focusSessionRepository.closeExpired(scope, now);

    const active = await this.focusSessionRepository.findActive(scope, now);
    if (active) {
      throw new ConflictException(`Focus mode is already active until ${active.endsAt.toISOString()}`);
    }

    try {
      const session = await this.focusSessionRepository.start(
        scope,
        now,
        new Date(now.getTime() + command.durationMinutes * 60_000)
      );

      return toFocusModeStatus(session, now);
    } catch (e) {
      // lost a race with a concurrent start for the same subscriber
      if ((e as { code?: number })?.code === MONGO_DUPLICATE_KEY) {
        throw new ConflictException('Focus mode is already active');
      }
      throw e;
    }
  }
}
