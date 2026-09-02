export type AmountOp = '+' | '-' | '*' | '/'

export type AmountExpr = {
  left: string
  op: AmountOp | null
  right: string
}

export const EMPTY_AMOUNT: AmountExpr = { left: '', op: null, right: '' }

const OP_MARK: Record<AmountOp, string> = {
  '+': '+',
  '-': '-',
  '*': '×',
  '/': '÷',
}

export function amountFromYuan(yuan: string): AmountExpr {
  return { left: yuan, op: null, right: '' }
}

export function displayAmount(expr: AmountExpr): string {
  if (!expr.left) return ''
  if (!expr.op) return expr.left
  return expr.right ? `${expr.left}${OP_MARK[expr.op]}${expr.right}` : `${expr.left}${OP_MARK[expr.op]}`
}

export function amountYuan(expr: AmountExpr): string | null {
  if (expr.op && expr.right) {
    const result = compute(expr.left, expr.op, expr.right)
    return result === null ? null : formatResult(result)
  }
  if (expr.op) return null
  return expr.left || null
}

export function pressDigit(expr: AmountExpr, digit: string): AmountExpr {
  if (!expr.op) return { ...expr, left: appendNum(expr.left, digit) }
  return { ...expr, right: appendNum(expr.right, digit) }
}

export function pressDot(expr: AmountExpr): AmountExpr {
  if (!expr.op) return { ...expr, left: appendDot(expr.left) }
  return { ...expr, right: appendDot(expr.right) }
}

export function pressOp(expr: AmountExpr, op: AmountOp): AmountExpr {
  if (!expr.left) return { left: '0', op, right: '' }
  if (expr.op && expr.right) {
    const result = compute(expr.left, expr.op, expr.right)
    if (result === null) return expr
    return { left: formatResult(result), op, right: '' }
  }
  return { ...expr, op, right: '' }
}

/** First tap inserts `primary`; a second tap before the next number swaps it to `secondary`. */
export function pressToggleOp(expr: AmountExpr, primary: AmountOp, secondary: AmountOp): AmountExpr {
  if (expr.op === primary && !expr.right) return { ...expr, op: secondary }
  return pressOp(expr, primary)
}

export function pressEquals(expr: AmountExpr): AmountExpr {
  if (!expr.op || !expr.right) return expr
  const result = compute(expr.left, expr.op, expr.right)
  if (result === null) return expr
  return { left: formatResult(result), op: null, right: '' }
}

export function pressClear(): AmountExpr {
  return EMPTY_AMOUNT
}

export function pressBackspace(expr: AmountExpr): AmountExpr {
  if (expr.op && expr.right) return { ...expr, right: expr.right.slice(0, -1) }
  if (expr.op) return { ...expr, op: null }
  if (!expr.left) return expr
  const left = expr.left.slice(0, -1)
  return left ? { ...expr, left } : EMPTY_AMOUNT
}

export function applyAmountKey(expr: AmountExpr, key: string): AmountExpr | null {
  if (/^[0-9]$/.test(key)) return pressDigit(expr, key)
  if (key === '.' || key === ',') return pressDot(expr)
  if (key === '+') return pressOp(expr, '+')
  if (key === '-') return pressOp(expr, '-')
  if (key === '*' || key === 'x' || key === 'X') return pressOp(expr, '*')
  if (key === '/') return pressOp(expr, '/')
  if (key === '=' || key === 'Enter') return pressEquals(expr)
  if (key === 'Backspace' || key === 'Delete') return pressBackspace(expr)
  if (key === 'Escape' || key === 'c' || key === 'C') return pressClear()
  return null
}

function appendNum(current: string, digit: string): string {
  if (!current || current === '0') return digit
  const [whole, frac] = current.split('.')
  if (frac !== undefined && frac.length >= 2) return current
  if (whole.length >= 10 && !current.includes('.')) return current
  return current + digit
}

function appendDot(current: string): string {
  if (!current) return '0.'
  if (current.includes('.')) return current
  return `${current}.`
}

function compute(left: string, op: AmountOp, right: string): number | null {
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (op === '+') return a + b
  if (op === '-') return a - b
  if (op === '*') return a * b
  if (b === 0) return null
  return a / b
}

function formatResult(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (!Number.isFinite(rounded)) return ''
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
