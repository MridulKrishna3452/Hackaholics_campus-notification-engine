import { IsInt, Max, Min } from 'class-validator';
import { EnvironmentWithSubscriber } from '../../shared/commands/project.command';
import { FOCUS_MODE_MAX_DURATION_MINUTES, FOCUS_MODE_MIN_DURATION_MINUTES } from '../dtos/focus-mode.dto';

/** Used by GetFocusMode and EndFocusMode. */
export class FocusModeCommand extends EnvironmentWithSubscriber {}

export class StartFocusModeCommand extends EnvironmentWithSubscriber {
  @IsInt()
  @Min(FOCUS_MODE_MIN_DURATION_MINUTES)
  @Max(FOCUS_MODE_MAX_DURATION_MINUTES)
  readonly durationMinutes: number;
}
