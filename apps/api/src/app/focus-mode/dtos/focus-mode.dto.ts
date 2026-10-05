import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import type { FocusSessionEntity } from '@novu/dal';

export const FOCUS_MODE_MIN_DURATION_MINUTES = 5;
export const FOCUS_MODE_MAX_DURATION_MINUTES = 480;

export class StartFocusModeRequestDto {
  @ApiProperty({
    description: `Length of the focus period in whole minutes (${FOCUS_MODE_MIN_DURATION_MINUTES}-${FOCUS_MODE_MAX_DURATION_MINUTES})`,
    example: 90,
  })
  @Type(() => Number)
  @IsInt()
  @Min(FOCUS_MODE_MIN_DURATION_MINUTES)
  @Max(FOCUS_MODE_MAX_DURATION_MINUTES)
  durationMinutes: number;
}

/**
 * SHARED CONTRACT (see ../../../../SHARED-CONTRACT.md). Person 2 relies on `sessionId`.
 * `isActive:false` with no other fields means "no focus session right now".
 */
export class FocusModeStatusResponseDto {
  @ApiProperty({ description: 'True while a focus period is running' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Focus session id; pass it to the catch-up summary endpoint' })
  sessionId?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC' })
  startedAt?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC planned end' })
  endsAt?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC, present only when the student ended the session early' })
  endedAt?: string;

  @ApiPropertyOptional({ description: 'Seconds left, present only while active' })
  remainingSeconds?: number;
}

export function toFocusModeStatus(session: FocusSessionEntity | null, now: Date = new Date()): FocusModeStatusResponseDto {
  if (!session) {
    return { isActive: false };
  }

  const isActive = !!session.open && session.endsAt.getTime() > now.getTime();

  return {
    isActive,
    sessionId: session._id,
    startedAt: session.startedAt.toISOString(),
    endsAt: session.endsAt.toISOString(),
    endedAt: session.endedAt?.toISOString(),
    remainingSeconds: isActive ? Math.ceil((session.endsAt.getTime() - now.getTime()) / 1000) : undefined,
  };
}
