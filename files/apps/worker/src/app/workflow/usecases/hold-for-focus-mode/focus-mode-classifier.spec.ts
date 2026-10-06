import { StepTypeEnum } from '@novu/shared';
import { expect } from 'chai';
import {
  classifyForFocusMode,
  extractEntityKey,
  FOCUS_HELD_STEP_TYPES,
  parseFocusCriticalRules,
} from './focus-mode-classifier';

describe('focus-mode-classifier', () => {
  const rules = { criticalWorkflowIdentifiers: ['exam-alert'], criticalTags: ['safety'] };

  describe('classifyForFocusMode', () => {
    it('treats a workflow with critical=true as critical', () => {
      expect(classifyForFocusMode({ workflowCritical: true, workflowIdentifier: 'x' }, rules)).to.deep.equal({
        critical: true,
        reason: 'workflow_critical_flag',
      });
    });

    it('treats an allow-listed workflow identifier as critical', () => {
      expect(classifyForFocusMode({ workflowIdentifier: 'exam-alert' }, rules)).to.deep.equal({
        critical: true,
        reason: 'identifier_allowlist',
      });
    });

    it('treats an allow-listed tag as critical', () => {
      expect(classifyForFocusMode({ workflowIdentifier: 'x', workflowTags: ['a', 'safety'] }, rules)).to.deep.equal({
        critical: true,
        reason: 'tag_allowlist',
      });
    });

    it('treats everything else as NOT critical (no guessing)', () => {
      expect(classifyForFocusMode({ workflowIdentifier: 'urgent-looking-name', workflowTags: ['urgent'] }, rules)).to
        .deep.equal({ critical: false });
      expect(classifyForFocusMode({}, rules)).to.deep.equal({ critical: false });
    });

    it('with empty rules only the workflow critical flag lets a notification through', () => {
      const empty = parseFocusCriticalRules({});
      expect(classifyForFocusMode({ workflowIdentifier: 'exam-alert' }, empty)).to.deep.equal({ critical: false });
    });
  });

  describe('parseFocusCriticalRules', () => {
    it('parses comma separated env values and trims blanks', () => {
      expect(
        parseFocusCriticalRules({ FOCUS_MODE_CRITICAL_WORKFLOW_IDS: ' a, b ,,', FOCUS_MODE_CRITICAL_TAGS: 'safety' })
      ).to.deep.equal({ criticalWorkflowIdentifiers: ['a', 'b'], criticalTags: ['safety'] });
    });
  });

  describe('extractEntityKey', () => {
    it('returns a trimmed string key', () => {
      expect(extractEntityKey({ entityKey: ' course:CS101 ' })).to.equal('course:CS101');
    });

    it('returns undefined for missing, non-string, empty or oversized keys', () => {
      expect(extractEntityKey(undefined)).to.equal(undefined);
      expect(extractEntityKey({})).to.equal(undefined);
      expect(extractEntityKey({ entityKey: 42 })).to.equal(undefined);
      expect(extractEntityKey({ entityKey: '   ' })).to.equal(undefined);
      expect(extractEntityKey({ entityKey: 'x'.repeat(201) })).to.equal(undefined);
    });
  });

  describe('FOCUS_HELD_STEP_TYPES', () => {
    it('holds delivery channels but never trigger/digest/delay/http steps', () => {
      expect(FOCUS_HELD_STEP_TYPES.has(StepTypeEnum.EMAIL)).to.equal(true);
      expect(FOCUS_HELD_STEP_TYPES.has(StepTypeEnum.TRIGGER)).to.equal(false);
      expect(FOCUS_HELD_STEP_TYPES.has(StepTypeEnum.DIGEST)).to.equal(false);
      expect(FOCUS_HELD_STEP_TYPES.has(StepTypeEnum.DELAY)).to.equal(false);
      expect(FOCUS_HELD_STEP_TYPES.has(StepTypeEnum.HTTP_REQUEST)).to.equal(false);
    });
  });
});
