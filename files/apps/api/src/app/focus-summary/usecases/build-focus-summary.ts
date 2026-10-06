import type { FocusHeldNotificationEntity } from '@novu/dal';
import { FocusSummaryGroupDto } from '../dtos/focus-summary.dto';

/**
 * Pure grouping. Rule: notifications are correlated ONLY by an explicit `entityKey`.
 * No key => its own group (`notification:<id>`); we never merge by workflow name, text or time.
 * Input is already one row per (session, notification), so counts are distinct notifications.
 */
export function buildFocusSummaryGroups(items: FocusHeldNotificationEntity[]): FocusSummaryGroupDto[] {
  const groups = new Map<string, FocusSummaryGroupDto & { _workflows: Map<string, number>; _channels: Set<string> }>();

  for (const item of items) {
    const groupKey = item.entityKey ?? `notification:${item._notificationId}`;
    const heldAt = new Date(item.heldAt).toISOString();

    let group = groups.get(groupKey);
    if (!group) {
      group = {
        groupKey,
        entityKey: item.entityKey ?? null,
        count: 0,
        workflows: [],
        channels: [],
        firstHeldAt: heldAt,
        lastHeldAt: heldAt,
        notificationIds: [],
        _workflows: new Map(),
        _channels: new Set(),
      };
      groups.set(groupKey, group);
    }

    group.count += 1;
    group.notificationIds.push(item._notificationId);
    group._workflows.set(item.workflowIdentifier, (group._workflows.get(item.workflowIdentifier) ?? 0) + 1);
    for (const step of item.stepTypes ?? []) group._channels.add(step);
    if (heldAt < group.firstHeldAt) group.firstHeldAt = heldAt;
    if (heldAt > group.lastHeldAt) group.lastHeldAt = heldAt;
  }

  return [...groups.values()]
    .map(({ _workflows, _channels, ...group }) => ({
      ...group,
      workflows: [..._workflows].map(([identifier, count]) => ({ identifier, count })),
      channels: [..._channels].sort(),
    }))
    .sort((a, b) => (a.firstHeldAt < b.firstHeldAt ? -1 : 1));
}
