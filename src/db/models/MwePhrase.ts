import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class MwePhraseModel extends Model {
  static override table = 'mwe_phrases';

  @field('source_lang') sourceLang!: string;
  @field('target_lang') targetLang!: string;
  @field('phrase') phrase!: string;
  @field('translation_equivalent') translationEquivalent!: string;
  @field('literal_gloss') literalGloss!: string | null;
  @field('mwe_type') mweType!: string | null;
  @field('gap_pattern') gapPattern!: string | null;
  @field('domain') domain!: string;
  @field('attribution') attribution!: string | null;
}
