import type { CapacitorConfig } from '@capacitor/cli'

const liveReload = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'app.autobill',
  appName: '轻记账',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
  },
  android: {
    allowMixedContent: true,
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
