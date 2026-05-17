import { TranslationFeedbackModel } from '@/db/models/TranslationFeedback';

describe('TranslationFeedbackModel', () => {
  it('table name = translation_feedback', () => {
    expect(TranslationFeedbackModel.table).toBe('translation_feedback');
  });
});
