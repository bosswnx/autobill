import { execSync } from 'node:child_process'
import { networkInterfaces } from 'node:os'

function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const item of addresses ?? []) {
      if (item.family === 'IPv4' && !item.internal) return item.address
    }
  }
}

const ip = lanAddress()
if (!ip) {
  console.error('没有局域网 IP，先连上 Wi-Fi。')
  process.exit(1)
}

const url = `http://${ip}:5173`
process.env.CAP_SERVER_URL = url
console.log(`真机热重载：${url}`)
console.log('另开一个终端跑：npm run dev:lan')
execSync('npx cap sync ios && npx cap open ios', {
  stdio: 'inherit',
  env: process.env,
})
