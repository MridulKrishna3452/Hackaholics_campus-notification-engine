import { Module } from '@nestjs/common';
import { FocusSessionRepository, SubscriberRepository } from '@novu/dal';
import { AuthModule } from '../auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { FocusModeController } from './focus-mode.controller';
import { EndFocusMode } from './usecases/end-focus-mode.usecase';
import { GetFocusMode } from './usecases/get-focus-mode.usecase';
import { StartFocusMode } from './usecases/start-focus-mode.usecase';

@Module({
  imports: [SharedModule, AuthModule],
  controllers: [FocusModeController],
  providers: [StartFocusMode, EndFocusMode, GetFocusMode, FocusSessionRepository, SubscriberRepository],
  exports: [FocusSessionRepository],
})
export class FocusModeModule {}
