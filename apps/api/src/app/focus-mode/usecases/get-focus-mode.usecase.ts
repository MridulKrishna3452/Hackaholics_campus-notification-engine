import { Injectable } from '@nestjs/common';
import { FocusSessionRepository, SubscriberRepository } from '@novu/dal';
import { FocusModeStatusResponseDto, toFocusModeStatus } from '../dtos/focus-mode.dto';
import { FocusModeCommand } from './focus-mode.command';
import { resolveFocusScope } from './resolve-focus-scope';

@Injectable()
export class GetFocusMode {
  constructor(
    private focusSessionRepository: FocusSessionRepository,
    private subscriberRepository: SubscriberRepository
  ) {}

  async execute(command: FocusModeCommand): Promise<FocusModeStatusResponseDto> {
    const scope = await resolveFocusScope(this.subscriberRepository, command);

    // Active session wins; otherwise report the latest (ended/expired) one so the client can still ask for its summary.
    const session =
      (await this.focusSessionRepository.findActive(scope)) ?? (await this.focusSessionRepository.findLatest(scope));

    return toFocusModeStatus(session);
  }
}
