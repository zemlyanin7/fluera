import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export class OpdsCatalog extends Model {
  static table = 'opds_catalogs'

  @field('name') name!: string
  @field('url') url!: string
  @field('catalog_type') catalogType!: string
  @field('last_fetched_at') lastFetchedAt!: number | null
}
