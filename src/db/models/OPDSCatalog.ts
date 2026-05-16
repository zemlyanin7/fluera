import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class OPDSCatalogModel extends Model {
  static override table = 'opds_catalogs';

  @field('name') name!: string;
  // URL без userinfo. Креды отдельно в expo-secure-store (см. spec §6.4).
  @field('url') url!: string;
  @field('requires_auth') requiresAuth!: boolean;
  @field('kind') kind!: string;
  @field('last_fetched_at') lastFetchedAt!: number | null;
  @field('created_at') createdAt!: number;
}
