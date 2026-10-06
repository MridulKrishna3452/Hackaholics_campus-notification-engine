import { Module } from '@nestjs/common';
import { FocusHeldNotificationRepository, FocusSessionRepository, SubscriberRepository } from '@novu/dal';
import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { FocusSummaryController } from './focus-summary.controller';
import { GetFocusSummary } from './usecases/get-focus-summary.usecase';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [FocusSummaryController],
  providers: [GetFocusSummary, FocusHeldNotificationRepository, FocusSessionRepository, SubscriberRepository],
})
export class FocusSummaryModule {}
