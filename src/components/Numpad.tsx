interface NumpadProps {
  value: string
  maxLen: number
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
}

export default function Numpad({ value, maxLen, onChange, onSubmit, disabled }: NumpadProps) {
  const press = (digit: string) => {
    if (disabled) return
    if (value.length < maxLen) onChange(value + digit)
  }

  const backspace = () => {
    if (disabled) return
    onChange(value.slice(0, -1))
  }

  return (
    <div className="numpad">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
        <button key={n} className="numpad-btn" onClick={() => press(String(n))} disabled={disabled}>
          {n}
        </button>
      ))}
      <button className="numpad-btn numpad-del" onClick={backspace} disabled={disabled}>⌫</button>
      <button className="numpad-btn" onClick={() => press('0')} disabled={disabled}>0</button>
      <button className="numpad-btn numpad-go" onClick={onSubmit} disabled={disabled}>→</button>
    </div>
  )
}
