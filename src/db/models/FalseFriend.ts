import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export type FalseFriendConfidence = 'high' | 'medium';

export class FalseFriendModel extends Model {
  static override table = 'false_friends';

  @field('source_lang') sourceLang!: string;
  @field('target_lang') targetLang!: string;
  @field('source_word') sourceWord!: string;
  @field('looks_like_native') looksLikeNative!: string;
  @field('actual_meaning') actualMeaning!: string;
  @field('confidence') confidence!: FalseFriendConfidence;
  @field('domain') domain!: string;
}
