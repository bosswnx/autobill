import type { zh } from './zh'

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

export const en: typeof zh = {
  appName: 'TagLedger',
  htmlLang: 'en',
  intl: 'en',

  common: {
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    delete: 'Delete',
    close: 'Close',
    loading: 'Loading…',
    none: 'None',
    confirm: 'OK',
    today: 'Today',
    yesterday: 'Yesterday',
    now: 'Now',
  },

  nav: {
    ledger: 'Ledger',
    stats: 'Stats',
    tags: 'Manage',
    settings: 'Settings',
    addEntry: 'Add entry',
  },

  boot: {
    opening: 'Opening your ledger…',
  },

  missingBook: {
    body: 'No ledger yet. Connect sync in Settings, or reopen the app to create a local book.',
    goSettings: 'Go to Settings',
  },

  entryType: {
    expense: 'Expense',
    income: 'Income',
    transfer: 'Transfer',
  },

  tagKind: {
    expense: 'Expense',
    income: 'Income',
  },

  ledger: {
    title: 'Ledger',
    expense: 'Expense',
    income: 'Income',
    net: 'Balance',
    savings: 'Savings',
    searchPlaceholder: 'Search notes',
    clearFilters: 'Clear',
    emptyTitle: 'Nothing this month',
    emptyHint: 'Add an entry. You can create tags as you go.',
    emptyFilteredTitle: 'No matching entries',
    emptyFilteredHint: 'Try different tags, or clear the filters.',
  },

  stats: {
    title: 'Stats',
    totalExpense: 'Expense',
    totalIncome: 'Income',
    net: 'Balance',
    assets: 'Assets',
    avgExpenseDay: 'Daily expense',
    avgExpenseMonth: 'Monthly expense',
    avgIncomeDay: 'Daily income',
    avgIncomeMonth: 'Monthly income',
    expense: 'Expense',
    income: 'Income',
    monthlyExpense: 'Monthly expense',
    monthlyIncome: 'Monthly income',
    assetChart: 'Assets',
    expenseTags: 'Expense tags',
    incomeTags: 'Income tags',
    drillHint: 'Click a tag to filter',
    emptyExpenseTags: 'No expense tags in this period',
    emptyIncomeTags: 'No income tags in this period',
    tagOnly: 'This tag only',
    tagOnlyMany: 'These tags only',
    clearFocus: 'Clear',
    drillTag: (name: string) => `See other tags inside “${name}”`,
    modeMonth: 'Mo',
    modeYear: 'Yr',
    noData: 'No data yet',
  },

  tags: {
    title: 'Tags',
    searchPlaceholder: 'Search tags',
    sortBy: 'Sort by',
    sortThen: '',
    sortSuffix: '',
    sortByAria: 'Sort by',
    sortDirAria: 'Sort direction',
    sortCount: 'Count',
    sortName: 'Name',
    sortDesc: 'Descending',
    sortAsc: 'Ascending',
    empty: 'No tags yet',
    emptyFiltered: 'No matching tags',
    add: 'Add',
    name: 'Name',
    namePlaceholder: 'e.g. Dining',
    icon: 'Icon',
    color: 'Color',
    pickIcon: 'Choose icon',
    pickColor: 'Choose color',
    viewLedger: 'View in ledger',
    addKind: {
      expense: 'Add expense tag',
      income: 'Add income tag',
    },
    editKind: {
      expense: 'Edit expense tag',
      income: 'Edit income tag',
    },
    entryCount: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
    deleteTitle: 'Delete tag',
    deleteHint: 'Choose what happens to tagged entries.',
    deleteTagOnly: 'Delete tag only',
    deleteTagOnlyDetail: 'Keep the entries. They just lose this tag.',
    deleteWithEntries: 'Delete tag and entries',
    deleteWithEntriesDetail: (n: number) =>
      n === 0
        ? 'No entries use this tag.'
        : `Deletes ${n === 1 ? '1 entry' : `${n} entries`} that use this tag.`,
  },

  manage: {
    title: 'Manage',
    tags: 'Tags',
    subscriptions: 'Subscriptions',
  },

  sub: {
    emptyTitle: 'No subscriptions yet',
    emptyHint: 'Rent, memberships, and salary can post themselves when due.',
    add: 'Add subscription',
    edit: 'Edit subscription',
    cadence: 'Repeat',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    day: 'Day',
    month: 'Month',
    enabled: 'Enabled',
    disabled: 'Disabled',
    paused: 'Paused',
    next: (when: string) => `Next ${when}`,
    summaryWeekly: (weekday: string, time: string) => `Weekly on ${weekday} at ${time}`,
    summaryMonthly: (day: number, time: string) => `Monthly on the ${ordinal(day)} at ${time}`,
    summaryMonthlyFromEnd: (day: number, time: string) =>
      day === 1 ? `Monthly on the last day at ${time}` : `Monthly on the ${ordinal(day)} last day at ${time}`,
    summaryYearly: (month: string, day: number, time: string) => `Yearly on ${month} ${ordinal(day)} at ${time}`,
    monthDayLabel: (month: string, day: number) => `${month} ${ordinal(day)}`,
    nthDay: (n: number) => `${ordinal(n)} day`,
    lastNthDay: (n: number) => (n === 1 ? 'Last day' : `${ordinal(n)} last`),
    nthPrefix: '',
    nthSuffix: '',
    fromStart: 'From start',
    fromEnd: 'From end',
    weekdayName: (n: number) =>
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][n] ?? '',
    pickDay: 'Choose day',
    pickMonthDay: 'Choose date',
    pickWeekday: 'Choose weekday',
    addTime: 'Add time',
    editTime: 'Edit time',
    times: 'Times',
    timeRequired: 'Add at least one time',
    deleteHint: 'Entries already posted stay in the ledger.',
  },

  entry: {
    create: 'Add entry',
    edit: 'Edit entry',
    tags: 'Tags',
    tagSearchPlaceholder: 'Search or press Enter to create',
    tagSearchAria: 'Search or create a tag',
    createNamed: (name: string) => `Create ${name}`,
    note: 'Note (optional)',
    amount: 'Amount',
    amountRequired: 'Enter an amount',
    amountNegative: 'Amount cannot be negative',
    date: 'Date',
    time: 'Time',
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    wipe: 'Erase all data',
    wipeHint: 'This device’s ledger, tags, subscriptions, and entries will be deleted and cannot be undone. Cloud and other devices are unchanged.',
    wipeWait: (n: number) => `Wait ${n}s to confirm`,
    wipeConfirm: 'Erase now',
  },

  savings: {
    title: 'Savings',
    amountRequired: 'Enter an amount',
  },

  sync: {
    title: 'Sync',
    connectedTo: (host: string) => `Connected to ${host}`,
    syncing: 'Syncing…',
    neverSynced: 'Not synced yet',
    lastSynced: (when: string) => `Last synced ${when}`,
    syncNow: 'Sync now',
    disconnect: 'Disconnect',
    confirmDisconnect: 'Confirm disconnect',
    disconnectHint:
      'Disconnect only stops sync on this device. Your local ledger stays. Cloud and other devices are unchanged.',
    hostedHint:
      'This page is served by the sync server. Enter this server’s target key and your user token to use the browser as a device.',
    connectHint: 'Connect a server to sync the ledger.',
    serverUrl: 'Server URL',
    targetKey: 'Server key',
    userToken: 'User token',
    tokenPlaceholder: (n: number) => `At least ${n} characters`,
    connect: 'Connect',
    connecting: 'Connecting…',
    urlRequired: 'Enter the server URL',
    targetKeyRequired: 'Enter the server key',
    tokenMin: (n: number) => `User token must be at least ${n} characters`,
    errors: {
      invalidTargetKey: 'Wrong server key',
      invalidUserToken: 'User token must be at least 8 characters',
      unauthorized: 'Sync credentials expired. Sign in again.',
      rateLimited: 'Too many attempts. Try again later.',
      payloadTooLarge: 'This sync payload is too large',
      invalidChange: 'The server rejected a local record',
      network: 'Could not reach the server',
      failed: 'Sync failed',
    },
  },

  login: {
    subtitle: 'Sync server',
    title: 'Sign in',
    hint: 'The first time you open this browser, confirm with the server key and your user token. After that, this browser is a device.',
    enter: 'Continue',
    verifying: 'Verifying…',
  },

  merge: {
    title: 'Both sides have data',
    hint: 'This device and the cloud both have a ledger. Pick one option — they will not be auto-merged.',
    localTitle: 'Keep this device, replace cloud',
    localDetail: 'Cloud records will be cleared and replaced with this device’s ledger.',
    cloudTitle: 'Keep cloud, replace this device',
    cloudDetail: 'Records on this device will be cleared and replaced with the cloud ledger.',
    bothTitle: 'Keep both',
    bothDetail:
      'Entries, tags, and subscriptions from both sides are kept. Tags with the same name may appear twice. Savings uses the newer value.',
  },

  pickers: {
    dateTitle: 'Choose date',
    timeTitle: 'Choose time',
    monthTitle: 'Choose month',
    yearTitle: 'Choose year',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    prevYear: 'Previous year',
    nextYear: 'Next year',
    prevYearPage: 'Previous years',
    nextYearPage: 'Next years',
    thisMonth: 'This month',
    thisYear: 'This year',
    monthAria: 'Month',
    hour: 'Hour',
    minute: 'Min',
    stepperDec: (label: string) => `Decrease ${label.toLowerCase()}`,
    stepperInc: (label: string) => `Increase ${label.toLowerCase()}`,
    weekdays: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ],
  },

  iconPicker: {
    title: 'Choose icon',
    searchPlaceholder: 'Search icon names',
    empty: 'No matching icons',
  },

  colorPicker: {
    title: 'Choose color',
  },

  keypad: {
    backspaceHint: 'Backspace, hold to clear',
    plusTimesHint: 'Plus, tap again for multiply',
    minusDivHint: 'Minus, tap again for divide',
  },

  seed: {
    bookName: 'Daily',
    tags: {
      food: 'Dining',
      coffee: 'Coffee',
      transit: 'Transit',
      salary: 'Salary',
      daily: 'Everyday',
      shopping: 'Shopping',
    },
    notes: {
      luckin: 'Luckin',
      metro: 'Metro',
      salary: 'Salary',
    },
  },

  iconCategory: {
    accessibility: 'Accessibility',
    account: 'Account',
    animals: 'Animals',
    arrows: 'Arrows',
    buildings: 'Buildings',
    charts: 'Charts',
    communication: 'Communication',
    connectivity: 'Connectivity',
    cursors: 'Cursors',
    design: 'Design',
    development: 'Development',
    devices: 'Devices',
    emoji: 'Emoji',
    files: 'Files',
    finance: 'Finance',
    'food-beverage': 'Food',
    gaming: 'Gaming',
    home: 'Home',
    layout: 'Layout',
    mail: 'Mail',
    math: 'Math',
    medical: 'Medical',
    multimedia: 'Media',
    nature: 'Nature',
    navigation: 'Navigation',
    notifications: 'Alerts',
    people: 'People',
    photography: 'Photo',
    science: 'Science',
    seasons: 'Seasons',
    security: 'Security',
    shapes: 'Shapes',
    shopping: 'Shopping',
    social: 'Social',
    sports: 'Sports',
    sustainability: 'Eco',
    text: 'Text',
    time: 'Time',
    tools: 'Tools',
    transportation: 'Transit',
    travel: 'Travel',
    weather: 'Weather',
  },
}
