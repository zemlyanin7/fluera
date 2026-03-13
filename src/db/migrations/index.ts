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
  ],
})
