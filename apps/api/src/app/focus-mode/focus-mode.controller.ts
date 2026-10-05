import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiExcludeController } from '@nestjs/swagger';
import { ExcludeFromIdempotency } from '../shared/framework/exclude-from-idempotency';
import { ApiCommonResponses } from '../shared/framework/response.decorator';
import { SubscriberSession } from '../shared/framework/user.decorator';
import { FocusModeStatusResponseDto, StartFocusModeRequestDto } from './dtos/focus-mode.dto';
import { FocusModeCommand, StartFocusModeCommand } from './usecases/focus-mode.command';
import { EndFocusMode } from './usecases/end-focus-mode.usecase';
import { GetFocusMode } from './usecases/get-focus-mode.usecase';
import { StartFocusMode } from './usecases/start-focus-mode.usecase';

/**
 * Student-facing Focus Mode controls. Same auth as the rest of /inbox: the subscriber JWT issued by POST /inbox/session.
 * The subscriber is always taken from the token, never from the request body.
 */
@ApiCommonResponses()
@Controller('/inbox/focus-mode')
@ApiExcludeController()
@ExcludeFromIdempotency()
export class FocusModeController {
  constructor(
    private startFocusModeUsecase: StartFocusMode,
    private endFocusModeUsecase: EndFocusMode,
    private getFocusModeUsecase: GetFocusMode
  ) {}

  @UseGuards(AuthGuard('subscriberJwt'))
  @Get('/')
  async getStatus(@SubscriberSession() subscriberSession: SubscriberSession): Promise<FocusModeStatusResponseDto> {
    return this.getFocusModeUsecase.execute(
      FocusModeCommand.create({
        organizationId: subscriberSession._organizationId,
        environmentId: subscriberSession._environmentId,
        subscriberId: subscriberSession.subscriberId, // external id; usecases resolve the DB _id
      })
    );
  }

  @UseGuards(AuthGuard('subscriberJwt'))
  @Post('/start')
  @HttpCode(HttpStatus.CREATED)
  async start(
    @SubscriberSession() subscriberSession: SubscriberSession,
    @Body() body: StartFocusModeRequestDto
  ): Promise<FocusModeStatusResponseDto> {
    return this.startFocusModeUsecase.execute(
      StartFocusModeCommand.create({
        organizationId: subscriberSession._organizationId,
        environmentId: subscriberSession._environmentId,
        subscriberId: subscriberSession.subscriberId, // external id; usecases resolve the DB _id
        durationMinutes: body.durationMinutes,
      })
    );
  }

  @UseGuards(AuthGuard('subscriberJwt'))
  @Post('/end')
  @HttpCode(HttpStatus.OK)
  async end(@SubscriberSession() subscriberSession: SubscriberSession): Promise<FocusModeStatusResponseDto> {
    return this.endFocusModeUsecase.execute(
      FocusModeCommand.create({
        organizationId: subscriberSession._organizationId,
        environmentId: subscriberSession._environmentId,
        subscriberId: subscriberSession.subscriberId, // external id; usecases resolve the DB _id
      })
    );
  }
}
