import type { CapacitorConfig } from '@capacitor/cli'

const liveReload = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'app.tagledger',
  appName: '标签记账',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      style: 'LIGHT',
      hidden: false,
    },
  },
  ...(liveReload
    ? {
        server: {
          url: liveReload,
          cleartext: true,
        },
      }
    : {}),
}

export default config
