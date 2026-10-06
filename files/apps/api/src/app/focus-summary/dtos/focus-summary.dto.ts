import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsOptional } from 'class-validator';

export class GetFocusSummaryQueryDto {
  @ApiPropertyOptional({ description: 'Focus session id from start/end/status. Defaults to the latest session.' })
  @IsOptional()
  @IsMongoId()
  sessionId?: string;
}

export class FocusSummaryWorkflowDto {
  @ApiProperty() identifier: string;
  @ApiProperty() count: number;
}

export class FocusSummaryGroupDto {
  @ApiProperty({ description: 'entityKey, or "notification:<id>" for notifications that carried no entityKey' })
  groupKey: string;

  @ApiPropertyOptional({ description: 'The correlation key supplied by the sender; null when none was supplied', nullable: true })
  entityKey: string | null;

  @ApiProperty({ description: 'Distinct notifications held for this group' })
  count: number;

  @ApiProperty({ type: [FocusSummaryWorkflowDto] })
  workflows: FocusSummaryWorkflowDto[];

  @ApiProperty({ description: 'Channels (step types) that were held, de-duplicated', type: [String] })
  channels: string[];

  @ApiProperty() firstHeldAt: string;
  @ApiProperty() lastHeldAt: string;
  @ApiProperty({ type: [String] }) notificationIds: string[];
}

/** SHARED CONTRACT (SHARED-CONTRACT.md §3). */
export class FocusSummaryResponseDto {
  @ApiProperty() sessionId: string;
  @ApiProperty() startedAt: string;
  @ApiProperty({ description: 'endedAt when ended early, otherwise the planned endsAt' }) endedAt: string;
  @ApiProperty({ description: 'Distinct notifications held during the session' }) totalHeld: number;
  @ApiProperty({ description: 'Number of groups after correlation/deduplication' }) totalGroups: number;
  @ApiProperty({ description: 'true when more than the cap were held and the list is incomplete' }) truncated: boolean;
  @ApiProperty({ type: [FocusSummaryGroupDto] }) groups: FocusSummaryGroupDto[];
}
