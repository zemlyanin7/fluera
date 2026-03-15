import { addColumns, schemaMigrations } from '@nozbe/watermelondb/Schema/migrations'

export default schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            { name: 'last_position', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            { name: 'total_chapters', type: 'number', isOptional: true },
            { name: 'content_version', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
})
