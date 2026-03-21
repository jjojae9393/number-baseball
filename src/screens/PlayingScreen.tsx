import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import { db } from '../firebase'
import { ref, set, push, update, onValue, onChildAdded, onChildChanged } from 'firebase/database'
import { calcResult, validateNum } from '../utils'
import Chat from '../components/Chat'

const TURN_TIME = 60

interface GuessEntry {
  key: string
  guess: string
  strike: number | null
  ball: number | null
  pending?: boolean
}

interface PlayingScreenProps {
  roomId: string
  myRole: string
  myNumber: string
  onGameEnd: (winner: string, guessCount: number) => void
}

export default function PlayingScreen({ roomId, myRole, myNumber, onGameEnd }: PlayingScreenProps) {
  const [isMyTurn, setIsMyTurn] = useState(myRole === 'p1')
  const [waitingResult, setWaitingResult] = useState(false)
  const [myGuesses, setMyGuesses] = useState<GuessEntry[]>([])
  const [oppGuesses, setOppGuesses] = useState<GuessEntry[]>([])
  const [guessInput, setGuessInput] = useState('')
  const [guessError, setGuessError] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [timer, setTimer] = useState(TURN_TIME)

  const gameOverRef = useRef(false)
  const myGuessesRef = useRef<GuessEntry[]>([])
  const oppGuessesRef = useRef<GuessEntry[]>([])
  const myGuessListRef = useRef<HTMLDivElement>(null)
  const oppGuessListRef = useRef<HTMLDivElement>(null)
  const waitingResultRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const opp = myRole === 'p1' ? 'p2' : 'p1'

  const scrollToBottom = useCallback((listRef: React.RefObject<HTMLDivElement | null>) => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [])

  // Timer logic
  useEffect(() => {
    if (gameOver) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    setTimer(TURN_TIME)
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          if (isMyTurn && !waitingResultRef.current && !gameOverRef.current) {
            set(ref(db, `rooms/${roomId}/turn`), opp)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isMyTurn, gameOver, roomId, opp])

  useEffect(() => {
    const unsubs: (() => void)[] = []

    const turnRef = ref(db, `rooms/${roomId}/turn`)
    unsubs.push(onValue(turnRef, (snap) => {
      const t = snap.val()
      if (!t) return
      const mine = t === myRole
      setIsMyTurn(mine)
      setWaitingResult(false)
      waitingResultRef.current = false
    }))

    const winnerRef = ref(db, `rooms/${roomId}/winner`)
    unsubs.push(onValue(winnerRef, (snap) => {
      const w = snap.val()
      if (w && !gameOverRef.current) {
        gameOverRef.current = true
        setGameOver(true)
        onGameEnd(w, myGuessesRef.current.length)
      }
    }))

    // Detect opponent disconnect during game
    const oppRef = ref(db, `rooms/${roomId}/${opp}`)
    unsubs.push(onValue(oppRef, (snap) => {
      if (!snap.exists() && !gameOverRef.current) {
        gameOverRef.current = true
        setGameOver(true)
        onGameEnd(myRole, myGuessesRef.current.length)
      }
    }))

    const myGuessRef = ref(db, `rooms/${roomId}/guesses/${myRole}`)
    unsubs.push(onChildAdded(myGuessRef, (snap) => {
      const g = snap.val()
      if (!myGuessesRef.current.find(e => e.key === snap.key)) {
        const entry: GuessEntry = { key: snap.key!, guess: g.guess, strike: g.strike, ball: g.ball, pending: g.strike == null }
        myGuessesRef.current = [...myGuessesRef.current, entry]
        setMyGuesses([...myGuessesRef.current])
        setTimeout(() => scrollToBottom(myGuessListRef), 50)
      }
    }))

    unsubs.push(onChildChanged(myGuessRef, (snap) => {
      const g = snap.val()
      const idx = myGuessesRef.current.findIndex(e => e.key === snap.key)
      const entry: GuessEntry = { key: snap.key!, guess: g.guess, strike: g.strike, ball: g.ball, pending: g.strike == null }

      if (idx !== -1) {
        myGuessesRef.current[idx] = entry
      } else {
        myGuessesRef.current.push(entry)
      }
      myGuessesRef.current = [...myGuessesRef.current]
      setMyGuesses([...myGuessesRef.current])

      if (g.strike != null) {
        if (g.strike === 3) {
          set(ref(db, `rooms/${roomId}/winner`), myRole)
        } else {
          set(ref(db, `rooms/${roomId}/turn`), opp)
        }
      }
    }))

    const oppGuessRef = ref(db, `rooms/${roomId}/guesses/${opp}`)
    unsubs.push(onChildAdded(oppGuessRef, (snap) => {
      const g = snap.val()
      if (g.strike == null) {
        const { strike, ball } = calcResult(myNumber, g.guess)
        update(snap.ref, { strike, ball })

        if (!oppGuessesRef.current.find(e => e.key === snap.key)) {
          const entry: GuessEntry = { key: snap.key!, guess: g.guess, strike, ball }
          oppGuessesRef.current = [...oppGuessesRef.current, entry]
          setOppGuesses([...oppGuessesRef.current])
          setTimeout(() => scrollToBottom(oppGuessListRef), 50)
        }

        if (strike === 3) {
          set(ref(db, `rooms/${roomId}/winner`), opp)
        }
      } else {
        if (!oppGuessesRef.current.find(e => e.key === snap.key)) {
          const entry: GuessEntry = { key: snap.key!, guess: g.guess, strike: g.strike, ball: g.ball }
          oppGuessesRef.current = [...oppGuessesRef.current, entry]
          setOppGuesses([...oppGuessesRef.current])
          setTimeout(() => scrollToBottom(oppGuessListRef), 50)
        }
      }
    }))

    return () => unsubs.forEach(fn => fn())
  }, [roomId, myRole, myNumber, opp, onGameEnd, scrollToBottom])

  const doGuess = () => {
    if (!isMyTurn || waitingResult || gameOver) return

    const val = guessInput.trim()
    const err = validateNum(val)
    if (err || myGuessesRef.current.some(g => g.guess === val)) {
      setGuessError(true)
      setTimeout(() => setGuessError(false), 1200)
      return
    }

    setGuessInput('')
    setWaitingResult(true)
    waitingResultRef.current = true

    push(ref(db, `rooms/${roomId}/guesses/${myRole}`), {
      guess: val,
      strike: null,
      ball: null,
    })
  }

  const renderResult = (g: GuessEntry): ReactNode => {
    if (g.pending || g.strike == null) {
      return <span className="g-pending">...</span>
    } else if (g.strike === 0 && g.ball === 0) {
      return <span className="g-out">OUT</span>
    } else {
      return (
        <>
          {g.strike > 0 && <span className="g-s">{g.strike}S</span>}
          {(g.ball ?? 0) > 0 && <span className="g-b">{g.ball}B</span>}
        </>
      )
    }
  }

  const maxRows = Math.max(myGuesses.length, oppGuesses.length, 1)
  const timerWarning = timer <= 10
  const canInput = isMyTurn && !waitingResult && !gameOver

  return (
    <div className="screen">
      {/* Status bar */}
      <div className="game-bar">
        <div className={`turn-badge ${isMyTurn ? 'mine' : 'theirs'}`}>
          {waitingResult ? '결과 대기중...' : isMyTurn ? '내 차례' : '상대방 차례'}
        </div>
        <div className={`timer ${timerWarning ? 'timer-warn' : ''}`}>
          {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
        </div>
        <div className="my-num-chip">
          내 숫자: <span>{myNumber}</span>
        </div>
      </div>

      {/* Scoreboard */}
      <div className="card scoreboard">
        <div className="sb-header">
          <div className="sb-col-header sb-me">나</div>
          <div className="sb-col-header sb-round">#</div>
          <div className="sb-col-header sb-opp">상대</div>
        </div>
        <div className="sb-body" ref={myGuessListRef}>
          {maxRows === 0 ? (
            <div className="empty-hint" style={{ gridColumn: '1 / -1' }}>게임 시작!</div>
          ) : (
            Array.from({ length: maxRows }).map((_, i) => {
              const my = myGuesses[i]
              const op = oppGuesses[i]
              return (
                <div key={i} className="sb-row">
                  <div className={`sb-cell sb-left ${my?.strike === 3 ? 'win' : ''}`}>
                    {my ? (
                      <>
                        <span className="sb-num">{my.guess}</span>
                        <span className="sb-result">{renderResult(my)}</span>
                      </>
                    ) : (
                      <span className="sb-empty">-</span>
                    )}
                  </div>
                  <div className="sb-round-num">{i + 1}</div>
                  <div className={`sb-cell sb-right ${op?.strike === 3 ? 'win' : ''}`}>
                    {op ? (
                      <>
                        <span className="sb-result">{renderResult(op)}</span>
                        <span className="sb-num">{op.guess}</span>
                      </>
                    ) : (
                      <span className="sb-empty">-</span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Guess input */}
      <div className="card">
        <div className="guess-input-row">
          <input
            className={`input${guessError ? ' error' : ''}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="???"
            autoComplete="off"
            maxLength={3}
            value={guessInput}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
              setGuessInput(digits)
            }}
            onKeyDown={(e) => {
              if (!canInput) return
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) doGuess()
            }}
            disabled={!canInput}
          />
          <button className="btn btn-primary" onClick={doGuess} disabled={!canInput}>
            추측
          </button>
        </div>
      </div>

      <Chat roomId={roomId} myRole={myRole} />
    </div>
  )
}
