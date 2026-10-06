import { Injectable } from '@nestjs/common';
import {
  CreateExecutionDetails,
  CreateExecutionDetailsCommand,
  DetailEnum,
  PinoLogger,
  StepRunRepository,
} from '@novu/application-generic';
import { FocusHeldNotificationRepository, FocusSessionRepository, JobEntity, JobRepository } from '@novu/dal';
import { ExecutionDetailsSourceEnum, ExecutionDetailsStatusEnum, JobStatusEnum } from '@novu/shared';
import {
  classifyForFocusMode,
  extractEntityKey,
  FOCUS_HELD_STEP_TYPES,
  parseFocusCriticalRules,
} from './focus-mode-classifier';

export type HoldForFocusModeParams = {
  job: JobEntity;
  /** `notification.critical` of the notification being processed */
  notificationCritical?: boolean;
  workflowTags?: string[];
};

/**
 * Feature flag. Off by default => zero extra queries and zero behaviour change for Community / Cloud / on-prem
 * until an operator sets IS_FOCUS_MODE_ENABLED=true on the worker.
 */
const isFocusModeEnabled = () => process.env.IS_FOCUS_MODE_ENABLED === 'true';

@Injectable()
export class HoldForFocusMode {
  constructor(
    private focusSessionRepository: FocusSessionRepository,
    private focusHeldNotificationRepository: FocusHeldNotificationRepository,
    private jobRepository: JobRepository,
    private stepRunRepository: StepRunRepository,
    private createExecutionDetails: CreateExecutionDetails,
    private logger: PinoLogger
  ) {
    this.logger.setContext(this.constructor.name);
  }

  /**
   * Returns true when the job was HELD (marked canceled + recorded for the catch-up summary) and the caller
   * must stop processing it. Returns false for "carry on and deliver normally" — the answer for every case that
   * is not positively "active session AND non-critical delivery step".
   */
  async execute({ job, notificationCritical, workflowTags }: HoldForFocusModeParams): Promise<boolean> {
    if (!isFocusModeEnabled()) return false;
    if (!job.type || !FOCUS_HELD_STEP_TYPES.has(job.type)) return false;

    const session = await this.focusSessionRepository.findActive({
      environmentId: job._environmentId,
      organizationId: job._organizationId,
      subscriberId: job._subscriberId,
    });
    if (!session) return false;

    const classification = classifyForFocusMode(
      { workflowCritical: notificationCritical, workflowIdentifier: job.identifier, workflowTags },
      parseFocusCriticalRules()
    );

    if (classification.critical) {
      this.logger.info(
        { jobId: job._id, focusSessionId: session._id, reason: classification.reason },
        'Focus mode active but notification is critical, delivering'
      );

      return false;
    }

    await this.focusHeldNotificationRepository.recordHeld({
      environmentId: job._environmentId,
      organizationId: job._organizationId,
      subscriberId: job._subscriberId,
      focusSessionId: session._id,
      notificationId: job._notificationId,
      transactionId: job.transactionId,
      workflowIdentifier: job.identifier,
      entityKey: extractEntityKey(job.payload),
      stepType: job.type,
      heldAt: new Date(),
    });

    // Same terminal handling the schedule check uses for a skipped step.
    await this.jobRepository.updateStatus(job._environmentId, job._id, JobStatusEnum.CANCELED);
    await this.stepRunRepository.create(job, { status: JobStatusEnum.CANCELED });
    await this.createExecutionDetails.execute(
      CreateExecutionDetailsCommand.create({
        ...CreateExecutionDetailsCommand.getDetailsFromJob(job),
        detail: DetailEnum.SKIPPED_STEP_FOCUS_MODE_ACTIVE,
        source: ExecutionDetailsSourceEnum.INTERNAL,
        status: ExecutionDetailsStatusEnum.SUCCESS,
        isTest: false,
        isRetry: false,
        raw: JSON.stringify({ focusSessionId: session._id, endsAt: session.endsAt }),
      })
    );

    return true;
  }
}
