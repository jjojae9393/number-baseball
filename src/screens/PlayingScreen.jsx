import { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../firebase'
import { ref, set, push, update, onValue, onChildAdded, onChildChanged } from 'firebase/database'
import { calcResult, validateNum } from '../utils'
import Chat from '../components/Chat'

const TURN_TIME = 60

export default function PlayingScreen({ roomId, myRole, myNumber, onGameEnd }) {
  const [isMyTurn, setIsMyTurn] = useState(myRole === 'p1')
  const [waitingResult, setWaitingResult] = useState(false)
  const [myGuesses, setMyGuesses] = useState([])
  const [oppGuesses, setOppGuesses] = useState([])
  const [guessInput, setGuessInput] = useState('')
  const [guessError, setGuessError] = useState(false)
  const [activeTab, setActiveTab] = useState('my')
  const [gameOver, setGameOver] = useState(false)
  const [timer, setTimer] = useState(TURN_TIME)

  const gameOverRef = useRef(false)
  const myGuessesRef = useRef([])
  const oppGuessesRef = useRef([])
  const guessInputRef = useRef(null)
  const myGuessListRef = useRef(null)
  const oppGuessListRef = useRef(null)
  const waitingResultRef = useRef(false)
  const timerRef = useRef(null)

  const opp = myRole === 'p1' ? 'p2' : 'p1'

  const scrollToBottom = useCallback((listRef) => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [])

  // Timer logic
  useEffect(() => {
    if (gameOver) {
      clearInterval(timerRef.current)
      return
    }

    setTimer(TURN_TIME)
    clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          // Time's up - skip turn if it's mine and not waiting for result
          if (isMyTurn && !waitingResultRef.current && !gameOverRef.current) {
            set(ref(db, `rooms/${roomId}/turn`), opp)
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [isMyTurn, gameOver, roomId, opp])

  useEffect(() => {
    const unsubs = []

    // Turn listener
    const turnRef = ref(db, `rooms/${roomId}/turn`)
    unsubs.push(onValue(turnRef, (snap) => {
      const t = snap.val()
      if (!t) return
      const mine = t === myRole
      setIsMyTurn(mine)
      setWaitingResult(false)
      waitingResultRef.current = false
      if (mine && !gameOverRef.current && guessInputRef.current) {
        setTimeout(() => guessInputRef.current?.focus(), 50)
      }
    }))

    // Winner listener
    const winnerRef = ref(db, `rooms/${roomId}/winner`)
    unsubs.push(onValue(winnerRef, (snap) => {
      const w = snap.val()
      if (w && !gameOverRef.current) {
        gameOverRef.current = true
        setGameOver(true)
        onGameEnd(w, myGuessesRef.current.length)
      }
    }))

    // My guesses - child_added
    const myGuessRef = ref(db, `rooms/${roomId}/guesses/${myRole}`)
    unsubs.push(onChildAdded(myGuessRef, (snap) => {
      const g = snap.val()
      if (!myGuessesRef.current.find(e => e.key === snap.key)) {
        const entry = { key: snap.key, guess: g.guess, strike: g.strike, ball: g.ball, pending: g.strike == null }
        myGuessesRef.current = [...myGuessesRef.current, entry]
        setMyGuesses([...myGuessesRef.current])
        setTimeout(() => scrollToBottom(myGuessListRef), 50)
      }
    }))

    // My guesses - child_changed (result filled in by opponent)
    unsubs.push(onChildChanged(myGuessRef, (snap) => {
      const g = snap.val()
      const idx = myGuessesRef.current.findIndex(e => e.key === snap.key)
      const entry = { key: snap.key, guess: g.guess, strike: g.strike, ball: g.ball, pending: g.strike == null }

      if (idx !== -1) {
        myGuessesRef.current[idx] = entry
      } else {
        myGuessesRef.current.push(entry)
      }
      myGuessesRef.current = [...myGuessesRef.current]
      setMyGuesses([...myGuessesRef.current])

      // Result arrived → check win or pass turn to opponent
      if (g.strike != null) {
        if (g.strike === 3) {
          set(ref(db, `rooms/${roomId}/winner`), myRole)
        } else {
          // Pass turn to opponent
          set(ref(db, `rooms/${roomId}/turn`), opp)
        }
      }
    }))

    // Opponent guesses - I calculate the result
    const oppGuessRef = ref(db, `rooms/${roomId}/guesses/${opp}`)
    unsubs.push(onChildAdded(oppGuessRef, (snap) => {
      const g = snap.val()
      if (g.strike == null) {
        const { strike, ball } = calcResult(myNumber, g.guess)
        update(snap.ref, { strike, ball })

        if (!oppGuessesRef.current.find(e => e.key === snap.key)) {
          const entry = { key: snap.key, guess: g.guess, strike, ball }
          oppGuessesRef.current = [...oppGuessesRef.current, entry]
          setOppGuesses([...oppGuessesRef.current])
          setTimeout(() => scrollToBottom(oppGuessListRef), 50)
        }

        if (strike === 3) {
          set(ref(db, `rooms/${roomId}/winner`), opp)
        }
      } else {
        if (!oppGuessesRef.current.find(e => e.key === snap.key)) {
          const entry = { key: snap.key, guess: g.guess, strike: g.strike, ball: g.ball }
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

    // Push guess — don't switch turn yet, wait for result
    push(ref(db, `rooms/${roomId}/guesses/${myRole}`), {
      guess: val,
      strike: null,
      ball: null,
    })
  }

  const renderGuessRow = (g) => {
    const isWin = !g.pending && g.strike === 3
    let result
    if (g.pending || g.strike == null) {
      result = <span className="g-pending">계산 중...</span>
    } else if (g.strike === 0 && g.ball === 0) {
      result = <span className="g-out">아웃</span>
    } else {
      result = (
        <>
          {g.strike > 0 && <span className="g-s">{g.strike}S</span>}
          {g.ball > 0 && <span className="g-b">{g.ball}B</span>}
        </>
      )
    }

    return (
      <div key={g.key} className={`guess-row${isWin ? ' win' : ''}`}>
        <span className="g-num">{g.guess}</span>
        <span className="g-result">{result}</span>
      </div>
    )
  }

  const timerWarning = timer <= 10
  const canInput = isMyTurn && !waitingResult && !gameOver

  return (
    <div className="screen">
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

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'my' ? 'active' : ''}`}
          onClick={() => setActiveTab('my')}
        >
          내 추측
        </button>
        <button
          className={`tab ${activeTab === 'opp' ? 'active' : ''}`}
          onClick={() => setActiveTab('opp')}
        >
          상대방 추측
        </button>
      </div>

      {activeTab === 'my' && (
        <div className="card">
          <div className="guess-list" ref={myGuessListRef}>
            {myGuesses.length === 0 ? (
              <div className="empty-hint">아직 추측하지 않았습니다</div>
            ) : (
              myGuesses.map(renderGuessRow)
            )}
          </div>
          <div className="guess-input-row">
            <input
              ref={guessInputRef}
              className={`input${guessError ? ' error' : ''}`}
              type="text"
              placeholder="???"
              maxLength={3}
              inputMode="numeric"
              autoComplete="off"
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && doGuess()}
              disabled={!canInput}
            />
            <button
              className="btn btn-primary"
              onClick={doGuess}
              disabled={!canInput}
            >
              추측
            </button>
          </div>
        </div>
      )}

      {activeTab === 'opp' && (
        <div className="card">
          <div className="guess-list" ref={oppGuessListRef}>
            {oppGuesses.length === 0 ? (
              <div className="empty-hint">상대방이 아직 추측하지 않았습니다</div>
            ) : (
              oppGuesses.map(renderGuessRow)
            )}
          </div>
        </div>
      )}

      <Chat roomId={roomId} myRole={myRole} />
    </div>
  )
}
