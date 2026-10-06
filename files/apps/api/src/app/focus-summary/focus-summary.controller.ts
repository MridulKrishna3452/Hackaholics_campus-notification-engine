import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiExcludeController } from '@nestjs/swagger';
import { ExcludeFromIdempotency } from '../shared/framework/exclude-from-idempotency';
import { ApiCommonResponses } from '../shared/framework/response.decorator';
import { SubscriberSession } from '../shared/framework/user.decorator';
import { FocusSummaryResponseDto, GetFocusSummaryQueryDto } from './dtos/focus-summary.dto';
import { GetFocusSummary } from './usecases/get-focus-summary.usecase';

/** Same auth as the rest of /inbox (subscriber JWT). Registered under its own module so it never edits Person 1's files. */
@ApiCommonResponses()
@Controller('/inbox/focus-mode')
@ApiExcludeController()
@ExcludeFromIdempotency()
export class FocusSummaryController {
  constructor(private getFocusSummaryUsecase: GetFocusSummary) {}

  @UseGuards(AuthGuard('subscriberJwt'))
  @Get('/summary')
  async getSummary(
    @SubscriberSession() subscriberSession: SubscriberSession,
    @Query() query: GetFocusSummaryQueryDto
  ): Promise<FocusSummaryResponseDto> {
    return this.getFocusSummaryUsecase.execute({
      organizationId: subscriberSession._organizationId,
      environmentId: subscriberSession._environmentId,
      subscriberId: subscriberSession.subscriberId,
      sessionId: query.sessionId,
    });
  }
}
