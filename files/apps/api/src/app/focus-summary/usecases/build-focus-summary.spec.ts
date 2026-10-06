import type { FocusHeldNotificationEntity } from '@novu/dal';
import { expect } from 'chai';
import { buildFocusSummaryGroups } from './build-focus-summary';

const held = (over: Partial<FocusHeldNotificationEntity>): FocusHeldNotificationEntity =>
  ({
    _id: 'x',
    _notificationId: 'n1',
    workflowIdentifier: 'wf',
    stepTypes: ['email'],
    heldAt: new Date('2026-01-01T10:00:00Z'),
    ...over,
  }) as FocusHeldNotificationEntity;

describe('buildFocusSummaryGroups', () => {
  it('merges notifications sharing an entityKey into one group', () => {
    const groups = buildFocusSummaryGroups([
      held({ _notificationId: 'n1', entityKey: 'course:CS101', workflowIdentifier: 'assignment-posted' }),
      held({
        _notificationId: 'n2',
        entityKey: 'course:CS101',
        workflowIdentifier: 'grade-posted',
        stepTypes: ['push', 'email'],
        heldAt: new Date('2026-01-01T10:30:00Z'),
      }),
    ]);

    expect(groups).to.have.length(1);
    expect(groups[0].count).to.equal(2);
    expect(groups[0].channels).to.deep.equal(['email', 'push']);
    expect(groups[0].workflows).to.deep.equal([
      { identifier: 'assignment-posted', count: 1 },
      { identifier: 'grade-posted', count: 1 },
    ]);
    expect(groups[0].firstHeldAt).to.equal('2026-01-01T10:00:00.000Z');
    expect(groups[0].lastHeldAt).to.equal('2026-01-01T10:30:00.000Z');
  });

  it('never merges notifications that have no entityKey, even from the same workflow', () => {
    const groups = buildFocusSummaryGroups([held({ _notificationId: 'n1' }), held({ _notificationId: 'n2' })]);

    expect(groups).to.have.length(2);
    expect(groups.map((g) => g.entityKey)).to.deep.equal([null, null]);
  });

  it('keeps different entityKeys apart', () => {
    const groups = buildFocusSummaryGroups([
      held({ _notificationId: 'n1', entityKey: 'a' }),
      held({ _notificationId: 'n2', entityKey: 'b' }),
    ]);

    expect(groups).to.have.length(2);
  });

  it('returns an empty list for no held notifications', () => {
    expect(buildFocusSummaryGroups([])).to.deep.equal([]);
  });
});
