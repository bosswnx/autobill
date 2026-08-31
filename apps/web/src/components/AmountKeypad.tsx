import { Delete as BackspaceIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { catalogs, useI18n } from '../i18n'
import type { AmountExpr } from '../lib/amountKeypad'
import {
  applyAmountKey,
  displayAmount,
  pressBackspace,
  pressClear,
  pressDigit,
  pressDot,
  pressEquals,
  pressOp,
} from '../lib/amountKeypad'
import { tapHaptic } from '../lib/haptic'

type Props = {
  expr: AmountExpr
  onChange: (next: AmountExpr) => void
}

const KEY =
  'amount-key flex h-14 items-center justify-center rounded-md text-[22px] font-medium leading-none transition-colors duration-150'
const NUM = `${KEY} bg-[#f4f3f0] text-ink hover:bg-[#ebeae6]`
const OP = `${KEY} amount-key-op bg-[#ecebe7] text-muted hover:bg-[#e3e2de] hover:text-ink`

const LONG_PRESS_MS = 450

export function AmountKeypad({ expr, onChange }: Props) {
  const { t } = useI18n()
  const shown = displayAmount(expr)
  const exprRef = useRef(expr)
  const onChangeRef = useRef(onChange)
  exprRef.current = expr
  onChangeRef.current = onChange

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isEditingField(event.target)) return
      if (event.key === 'Enter' && isActionButton(event.target)) return
      const next = applyAmountKey(exprRef.current, event.key)
      if (!next) return
      event.preventDefault()
      onChangeRef.current(next)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div>
      <div className="flex items-baseline gap-1 border-b border-line pb-2">
        <span className="text-2xl text-faint">¥</span>
        <div className={`w-full text-4xl font-semibold tracking-tight ${shown ? 'text-ink' : 'text-faint'}`}>
          {shown || '0'}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '7'))}>
          7
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '8'))}>
          8
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '9'))}>
          9
        </Key>
        <Key className={OP} onClick={() => onChange(pressOp(expr, '/'))}>
          ÷
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '4'))}>
          4
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '5'))}>
          5
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '6'))}>
          6
        </Key>
        <Key className={OP} onClick={() => onChange(pressOp(expr, '*'))}>
          ×
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '1'))}>
          1
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '2'))}>
          2
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '3'))}>
          3
        </Key>
        <Key className={OP} onClick={() => onChange(pressOp(expr, '-'))}>
          −
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDigit(expr, '0'))}>
          0
        </Key>
        <Key className={NUM} onClick={() => onChange(pressDot(expr))}>
          .
        </Key>
        <Key
          className={OP}
          aria-label={t.keypad.backspaceHint}
          onClick={() => onChange(pressBackspace(expr))}
          onLongPress={() => onChange(pressClear())}
        >
          <BackspaceIcon className="size-[22px]" strokeWidth={2} />
        </Key>
        <Key className={OP} onClick={() => onChange(pressOp(expr, '+'))}>
          +
        </Key>
        <Key className={`${KEY} amount-key-op col-span-4 bg-[#ecebe7] text-ink hover:bg-[#e3e2de]`} onClick={() => onChange(pressEquals(expr))}>
          =
        </Key>
      </div>
    </div>
  )
}

function Key({
  className,
  onClick,
  onLongPress,
  children,
  'aria-label': ariaLabel,
}: {
  className: string
  onClick: () => void
  onLongPress?: () => void
  children: ReactNode
  'aria-label'?: string
}) {
  const timer = useRef(0)
  const didLongPress = useRef(false)

  function clearTimer() {
    if (!timer.current) return
    window.clearTimeout(timer.current)
    timer.current = 0
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onContextMenu={(event) => {
        if (onLongPress) event.preventDefault()
      }}
      onClick={() => {
        if (didLongPress.current) {
          didLongPress.current = false
          return
        }
        onClick()
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.currentTarget.dataset.pressed = 'true'
        tapHaptic()
        didLongPress.current = false
        if (!onLongPress) return
        timer.current = window.setTimeout(() => {
          timer.current = 0
          didLongPress.current = true
          onLongPress()
          tapHaptic()
        }, LONG_PRESS_MS)
      }}
      onPointerUp={(event) => {
        delete event.currentTarget.dataset.pressed
        clearTimer()
      }}
      onPointerCancel={(event) => {
        delete event.currentTarget.dataset.pressed
        clearTimer()
      }}
      onPointerLeave={(event) => {
        delete event.currentTarget.dataset.pressed
        clearTimer()
      }}
      className={className}
    >
      {children}
    </button>
  )
}

function isEditingField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function isActionButton(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const button = target.closest('button')
  if (!button) return false
  const label = button.textContent?.trim()
  if (!label) return false
  return Object.values(catalogs).some(
    (messages) =>
      label === messages.common.save ||
      label === messages.common.delete ||
      label === messages.common.close,
  )
}
