import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { Agent } from './store.ts'
import {
  aliveTags,
  createCategory,
  createEntry,
  createSubscription,
  createTag,
  defaultPeriod,
  deleteCategory,
  deleteEntry,
  deleteSubscription,
  deleteTag,
  getEntry,
  isValidPeriod,
  ledgerInfo,
  listCategories,
  listEntries,
  listSubscriptions,
  setSavings,
  signedCentsFrom,
  stats,
  tagUsage,
  tagView,
  updateCategory,
  updateEntry,
  updateSubscription,
  updateTag,
} from './store.ts'

const timeDescription =
  'Time as ISO 8601 (2026-11-06T12:30:00+08:00) or local "YYYY-MM-DD HH:mm" / "YYYY-MM-DD". ' +
  'Omitted means now. The server time zone is reported by ledger_info.'

const amountShape = {
  amountCents: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Amount in integer cents (3650 = ¥36.50). Use either this or amountYuan.'),
  amountYuan: z
    .number()
    .min(0)
    .optional()
    .describe('Amount in yuan (36.5 = ¥36.50). Use either this or amountCents.'),
}

const categoryShape = {
  categoryId: z
    .string()
    .nullable()
    .optional()
    .describe(
      'Existing category id. null clears it. Omit to leave the entry uncategorized on create, or unchanged on update.',
    ),
  categoryPath: z
    .string()
    .optional()
    .describe('Category path such as "餐饮-咖啡". Unknown paths fail; create with create_category first.'),
}

const tagSelectorShape = {
  tagIds: z.array(z.string()).optional().describe('Existing tag ids.'),
  tagNames: z
    .array(z.string())
    .optional()
    .describe('Existing tag names of the same kind; unknown names fail. Create tags with create_tag first.'),
}

function ok(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  }
}

export function registerTools(server: McpServer, agent: Agent): void {
  /* ---------------------------- ledger ---------------------------- */

  server.registerTool(
    'ledger_info',
    {
      title: 'Ledger info',
      description:
        'Read the ledger: the single book, currency, current savings (assets), counts, and the ' +
        'server time and time zone. Call this first when you need ids or the current date.',
      annotations: { readOnlyHint: true },
    },
    async () => ok(ledgerInfo(agent)),
  )

  server.registerTool(
    'set_savings',
    {
      title: 'Set savings',
      description:
        'Set the current savings (assets) to an exact value, like the savings field in Settings. ' +
        'The book opening balance is adjusted so opening + all income - all expense equals this value.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        savingsCents: z
          .number()
          .int()
          .optional()
          .describe('Savings in integer cents. May be negative. Use either this or savingsYuan.'),
        savingsYuan: z
          .number()
          .optional()
          .describe('Savings in yuan. May be negative. Use either this or savingsCents.'),
      },
    },
    async (args) => ok({ book: setSavings(agent, signedCentsFrom(args)) }),
  )

  /* ----------------------------- tags ----------------------------- */

  server.registerTool(
    'list_tags',
    {
      title: 'List tags',
      description:
        'List the flat tags of the ledger with their entry counts. Optionally filter by kind or name.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        kind: z.enum(['expense', 'income']).optional().describe('Only tags of this kind.'),
        query: z.string().optional().describe('Case-insensitive name substring.'),
      },
    },
    async (args) => {
      const usage = tagUsage(agent)
      const needle = args.query?.trim().toLowerCase() ?? ''
      const tags = aliveTags(agent)
        .filter((tag) => (args.kind ? tag.kind === args.kind : true))
        .filter((tag) => (needle ? tag.name.toLowerCase().includes(needle) : true))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tag) => tagView(tag, usage))
      return ok({ tags })
    },
  )

  server.registerTool(
    'create_tag',
    {
      title: 'Create tag',
      description:
        'Create a tag. Returns the existing tag when one with the same name and kind already exists. ' +
        'Tags are flat; kind is expense or income and cannot change later.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        name: z.string().min(1).describe('Tag name, e.g. 餐饮 or Dining.'),
        kind: z.enum(['expense', 'income']).optional().describe('Default expense.'),
        color: z.string().optional().describe('Hex color such as #c45c26. Picked automatically when omitted.'),
        icon: z.string().nullable().optional().describe('Lucide icon name, or null.'),
      },
    },
    async (args) => ok({ tag: createTag(agent, args) }),
  )

  server.registerTool(
    'update_tag',
    {
      title: 'Update tag',
      description: 'Rename a tag, change its color or icon. The kind cannot change.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        id: z.string().describe('Tag id.'),
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        icon: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const { id, ...patch } = args
      return ok({ tag: updateTag(agent, id, patch) })
    },
  )

  server.registerTool(
    'delete_tag',
    {
      title: 'Delete tag',
      description:
        'Soft-delete a tag. With withEntries=true the entries carrying this tag are deleted too, ' +
        'matching the two choices in the tags screen.',
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        id: z.string().describe('Tag id.'),
        withEntries: z
          .boolean()
          .optional()
          .describe('Also delete every entry that carries this tag (default false).'),
      },
    },
    async (args) => ok(deleteTag(agent, args.id, { withEntries: args.withEntries })),
  )

  /* --------------------------- categories ------------------------- */

  server.registerTool(
    'list_categories',
    {
      title: 'List categories',
      description:
        'List the two-level category tree with entry counts. Roots come first, each followed by its ' +
        'subcategories; path looks like "餐饮-咖啡".',
      annotations: { readOnlyHint: true },
      inputSchema: {
        kind: z.enum(['expense', 'income']).optional().describe('Only categories of this kind.'),
      },
    },
    async (args) => ok({ categories: listCategories(agent, args.kind) }),
  )

  server.registerTool(
    'create_category',
    {
      title: 'Create category',
      description:
        'Create a category or a subcategory. Categories are two levels at most: parentId must point ' +
        'at a root category. Returns the existing one when name and parent already match.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        name: z.string().min(1).describe('Category name, e.g. 餐饮 or 咖啡.'),
        kind: z.enum(['expense', 'income']).optional().describe('Default expense.'),
        parentId: z
          .string()
          .nullable()
          .optional()
          .describe('Root category id for a subcategory; null or omitted creates a root.'),
        color: z.string().optional().describe('Hex color. Picked automatically when omitted.'),
        icon: z.string().nullable().optional().describe('Lucide icon name, or null.'),
      },
    },
    async (args) => ok({ category: createCategory(agent, args) }),
  )

  server.registerTool(
    'update_category',
    {
      title: 'Update category',
      description: 'Rename a category, change its color or icon. It cannot be moved or change kind.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        id: z.string().describe('Category id.'),
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        icon: z.string().nullable().optional(),
      },
    },
    async (args) => {
      const { id, ...patch } = args
      return ok({ category: updateCategory(agent, id, patch) })
    },
  )

  server.registerTool(
    'delete_category',
    {
      title: 'Delete category',
      description:
        'Soft-delete a category and its subcategories. By default entries in them become ' +
        'uncategorized; withEntries=true deletes those entries instead.',
      annotations: { readOnlyHint: false, destructiveHint: true },
      inputSchema: {
        id: z.string().describe('Category id.'),
        withEntries: z
          .boolean()
          .optional()
          .describe('Also delete every entry in the category and its subcategories (default false).'),
      },
    },
    async (args) => ok(deleteCategory(agent, args.id, { withEntries: args.withEntries })),
  )

  /* ---------------------------- entries --------------------------- */

  server.registerTool(
    'list_entries',
    {
      title: 'List entries',
      description:
        'List ledger entries newest first. Filter by month, date range, type, tags (all must match), ' +
        'or a note substring. Amounts are returned in cents and yuan.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional()
          .describe('Month key such as 2026-11 (local time).'),
        from: z.string().optional().describe('Inclusive start date, YYYY-MM-DD (local).'),
        to: z.string().optional().describe('Inclusive end date, YYYY-MM-DD (local).'),
        type: z.enum(['expense', 'income']).optional(),
        categoryId: z
          .string()
          .optional()
          .describe('Only entries in this category or its subcategories.'),
        tagIds: z.array(z.string()).optional().describe('Only entries carrying all of these tags.'),
        query: z.string().optional().describe('Case-insensitive note substring.'),
        limit: z.number().int().min(1).max(500).optional().describe('Default 100, max 500.'),
        offset: z.number().int().min(0).optional(),
      },
    },
    async (args) => ok({ entries: listEntries(agent, args) }),
  )

  server.registerTool(
    'get_entry',
    {
      title: 'Get entry',
      description: 'Read one entry by id, including its tag names.',
      annotations: { readOnlyHint: true },
      inputSchema: { id: z.string().describe('Entry id.') },
    },
    async (args) => ok({ entry: getEntry(agent, args.id) }),
  )

  server.registerTool(
    'create_entry',
    {
      title: 'Create entry',
      description:
        'Record an expense or income. This is the same as adding an entry in the app: type, amount, ' +
        'tags, note, and time. Tags must already exist: look them up with list_tags and create new ' +
        'ones with create_tag before recording. Unknown tag names fail the call.',
      annotations: { readOnlyHint: false },
      inputSchema: {
        type: z.enum(['expense', 'income']).describe('expense or income.'),
        ...amountShape,
        currency: z.string().optional().describe('Defaults to the book currency (usually CNY).'),
        ...categoryShape,
        ...tagSelectorShape,
        note: z.string().optional().describe('Free text note, e.g. 午饭.'),
        occurredAt: z.string().optional().describe(timeDescription),
      },
    },
    async (args) => ok({ entry: createEntry(agent, args) }),
  )

  server.registerTool(
    'update_entry',
    {
      title: 'Update entry',
      description:
        'Edit an existing entry. Only the fields you pass change. Changing type drops tags of the ' +
        'other kind unless tagIds/tagNames are passed.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        id: z.string().describe('Entry id.'),
        type: z.enum(['expense', 'income']).optional(),
        ...amountShape,
        currency: z.string().optional(),
        ...categoryShape,
        ...tagSelectorShape,
        note: z.string().optional(),
        occurredAt: z.string().optional().describe(timeDescription),
      },
    },
    async (args) => {
      const { id, ...patch } = args
      return ok({ entry: updateEntry(agent, id, patch) })
    },
  )

  server.registerTool(
    'delete_entry',
    {
      title: 'Delete entry',
      description: 'Soft-delete one entry. It disappears from the ledger on every device.',
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: { id: z.string().describe('Entry id.') },
    },
    async (args) => ok(deleteEntry(agent, args.id)),
  )

  /* ----------------------------- stats ---------------------------- */

  server.registerTool(
    'ledger_stats',
    {
      title: 'Ledger statistics',
      description:
        'Totals for a month or a year: expense, income, net, averages per day/month, the running ' +
        'asset line, and the per-tag breakdown with shares. Also returns all-time savings. ' +
        'Pass expenseFocusTagIds / incomeFocusTagIds to drill into tags like the stats screen: ' +
        'totals are scoped to entries carrying all focus tags, other tags are broken down, and ' +
        'entries with no other tag land in remainderCents.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        mode: z.enum(['month', 'year']).optional().describe('Default month.'),
        period: z
          .string()
          .optional()
          .describe('YYYY-MM for month mode, YYYY for year mode. Defaults to the current period.'),
        includeSeries: z
          .boolean()
          .optional()
          .describe('Include the day/month series (default true).'),
        expenseFocusTagIds: z
          .array(z.string())
          .optional()
          .describe('Expense drilldown: entries must carry all of these tag ids.'),
        incomeFocusTagIds: z
          .array(z.string())
          .optional()
          .describe('Income drilldown: entries must carry all of these tag ids.'),
        tagLimit: z.number().int().min(1).max(100).optional().describe('Top tags per kind (default 20).'),
      },
    },
    async (args) => {
      const mode = args.mode ?? 'month'
      const period = args.period ?? defaultPeriod(mode)
      if (!isValidPeriod(mode, period)) {
        throw new Error(
          mode === 'month' ? 'period must be YYYY-MM' : 'period must be YYYY',
        )
      }
      const result = stats(agent, mode, period, {
        expenseTagIds: args.expenseFocusTagIds,
        incomeTagIds: args.incomeFocusTagIds,
      })
      const tagLimit = args.tagLimit ?? 20
      return ok({
        ...result,
        expenseSeries: args.includeSeries === false ? undefined : result.expenseSeries,
        incomeSeries: args.includeSeries === false ? undefined : result.incomeSeries,
        assetSeries: args.includeSeries === false ? undefined : result.assetSeries,
        expenseTags: {
          ...result.expenseTags,
          items: result.expenseTags.items.slice(0, tagLimit),
        },
        incomeTags: {
          ...result.incomeTags,
          items: result.incomeTags.items.slice(0, tagLimit),
        },
      })
    },
  )

  /* ------------------------- subscriptions ------------------------ */

  server.registerTool(
    'list_subscriptions',
    {
      title: 'List subscriptions',
      description:
        'List recurring expenses/income with their schedule, enabled state, and next run time.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        includeDisabled: z.boolean().optional().describe('Default true.'),
      },
    },
    async (args) => ok({ subscriptions: listSubscriptions(agent, args.includeDisabled ?? true) }),
  )

  server.registerTool(
    'create_subscription',
    {
      title: 'Create subscription',
      description:
        'Create a recurring expense or income. Each time slot has a cadence: weekly (day 0-6, ' +
        'Sunday=0), monthly (day 1-31, optional fromEnd), or yearly (month 1-12, day 1-31). ' +
        'Tags must already exist: create them with create_tag first.',
      annotations: { readOnlyHint: false },
      inputSchema: {
        type: z.enum(['expense', 'income']).optional().describe('Default expense.'),
        ...amountShape,
        currency: z.string().optional(),
        ...tagSelectorShape,
        note: z.string().optional(),
        times: z
          .array(
            z.object({
              cadence: z.enum(['weekly', 'monthly', 'yearly']).optional(),
              month: z.number().int().min(1).max(12).optional(),
              day: z.number().int().min(0).max(31).optional(),
              fromEnd: z.boolean().optional().describe('Monthly only: count from the last day.'),
              hour: z.number().int().min(0).max(23).optional(),
              minute: z.number().int().min(0).max(59).optional(),
            }),
          )
          .min(1)
          .describe('At least one time slot.'),
        enabled: z.boolean().optional().describe('Default true.'),
      },
    },
    async (args) => ok({ subscription: createSubscription(agent, args) }),
  )

  server.registerTool(
    'update_subscription',
    {
      title: 'Update subscription',
      description:
        'Edit a subscription: amount, tags, note, enabled state, or the whole times array. ' +
        'Re-enabling restarts the schedule from now, like the app.',
      annotations: { readOnlyHint: false, idempotentHint: true },
      inputSchema: {
        id: z.string().describe('Subscription id.'),
        type: z.enum(['expense', 'income']).optional(),
        ...amountShape,
        currency: z.string().optional(),
        ...tagSelectorShape,
        note: z.string().optional(),
        times: z
          .array(
            z.object({
              cadence: z.enum(['weekly', 'monthly', 'yearly']).optional(),
              month: z.number().int().min(1).max(12).optional(),
              day: z.number().int().min(0).max(31).optional(),
              fromEnd: z.boolean().optional(),
              hour: z.number().int().min(0).max(23).optional(),
              minute: z.number().int().min(0).max(59).optional(),
            }),
          )
          .min(1)
          .optional(),
        enabled: z.boolean().optional(),
      },
    },
    async (args) => {
      const { id, ...patch } = args
      return ok({ subscription: updateSubscription(agent, id, patch) })
    },
  )

  server.registerTool(
    'delete_subscription',
    {
      title: 'Delete subscription',
      description: 'Soft-delete a subscription. Entries it already created stay in the ledger.',
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      inputSchema: { id: z.string().describe('Subscription id.') },
    },
    async (args) => ok(deleteSubscription(agent, args.id)),
  )
}
