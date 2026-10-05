import { BadRequestException } from '@nestjs/common';
import { SubscriberRepository } from '@novu/dal';

/**
 * The inbox JWT carries the *external* subscriberId. FocusSession (and Person 2's held-notification records)
 * store the subscriber's database _id, so resolve it once here.
 */
export async function resolveFocusScope(
  subscriberRepository: SubscriberRepository,
  command: { environmentId: string; organizationId: string; subscriberId: string }
) {
  const subscriber = await subscriberRepository.findBySubscriberId(
    command.environmentId,
    command.subscriberId,
    false,
    '_id'
  );

  if (!subscriber) {
    throw new BadRequestException(`Subscriber with id: ${command.subscriberId} is not found.`);
  }

  return {
    environmentId: command.environmentId,
    organizationId: command.organizationId,
    subscriberId: subscriber._id,
  };
}
