import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, set, update, remove, onValue, get } from 'firebase/database'
import { validateNum } from '../utils'
import Chat from '../components/Chat'

export default function RoomScreen({ roomId, myRole, roomName, onGameStart, onLeave }) {
  const [myReady, setMyReady] = useState(false)
  const [oppStatus, setOppStatus] = useState('absent')
  const [numInput, setNumInput] = useState('')
  const [error, setError] = useState('')
  const numInputRef = useRef(null)
  const gameStartedRef = useRef(false)

  useEffect(() => {
    gameStartedRef.current = false
    setMyReady(false)
    setNumInput('')
    setError('')

    const roomRef = ref(db, `rooms/${roomId}`)

    const unsub = onValue(roomRef, (snap) => {
      const room = snap.val()
      if (!room || room.status === 'ended') {
        if (myRole === 'p2' && !gameStartedRef.current) {
          alert('방장이 방을 닫았습니다.')
          onLeave()
        }
        return
      }

      const oppRole = myRole === 'p1' ? 'p2' : 'p1'
      const oppData = room[oppRole]

      if (!oppData) {
        setOppStatus('absent')
      } else if (oppData.ready) {
        setOppStatus('ready')
      } else {
        setOppStatus('waiting')
      }

      // Reset my ready state if room was reset (e.g. after game end)
      const myData = room[myRole]
      if (myData && !myData.ready) {
        setMyReady(false)
      }

      // Both ready → start game
      if (room.p1?.ready && room.p2?.ready && !gameStartedRef.current) {
        gameStartedRef.current = true
        onGameStart(numInput || numInputRef.current?.value || '')
      }
    })

    return () => unsub()
  }, [roomId, myRole, onGameStart, onLeave, numInput])

  const handleReady = () => {
    const val = numInput.trim()
    const err = validateNum(val)
    if (err) {
      setError(err)
      return
    }
    setError('')
    setMyReady(true)
    set(ref(db, `rooms/${roomId}/${myRole}/ready`), true)
  }

  const handleLeave = async () => {
    // Remove my player data
    await remove(ref(db, `rooms/${roomId}/${myRole}`))

    // Check if the other player is still in the room
    const oppRole = myRole === 'p1' ? 'p2' : 'p1'
    const oppSnap = await get(ref(db, `rooms/${roomId}/${oppRole}`))

    if (!oppSnap.exists()) {
      // Both players gone → delete room
      await remove(ref(db, `rooms/${roomId}`))
    } else {
      // Other player still here → set status to waiting
      await set(ref(db, `rooms/${roomId}/status`), 'waiting')
    }

    onLeave()
  }

  const handleNumKeyDown = (e) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      handleReady()
      return
    }
    if (e.key === 'Backspace') {
      e.preventDefault()
      setNumInput(prev => prev.slice(0, -1))
      return
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      setNumInput(prev => (prev.length < 3 ? prev + e.key : prev))
    }
  }

  return (
    <div className="screen">
      <div className="header" style={{ paddingBottom: 8 }}>
        <h1 style={{ fontSize: '1.4rem' }}>{roomName}</h1>
      </div>

      <div className="card">
        <div className="player-slots">
          <div className="player-slot me">
            <div className="slot-label">나</div>
            <div className={`slot-status ${myReady ? 'ready' : 'waiting'}`}>
              {myReady ? '준비완료' : '대기중'}
            </div>
          </div>
          <div className="player-slot">
            <div className="slot-label">상대방</div>
            <div className={`slot-status ${oppStatus}`}>
              {oppStatus === 'absent' ? '입장 대기' : oppStatus === 'ready' ? '준비완료' : '대기중'}
            </div>
          </div>
        </div>

        <div className="divider" />

        {!myReady ? (
          <div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 10 }}>
              비밀 숫자를 정하고 준비하세요
            </p>
            <input
              ref={numInputRef}
              className="input input-mono"
              type="text"
              placeholder="000"
              autoComplete="off"
              readOnly
              value={numInput}
              onKeyDown={handleNumKeyDown}
            />
            {error && <div className="err">{error}</div>}
            <p className="hint">3자리 · 첫 자리 0 불가 · 중복 허용</p>
            <button className="btn btn-success" style={{ marginTop: 12 }} onClick={handleReady}>
              준비 완료
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <span className="dot dot-ok">준비 완료 — 상대방을 기다리는 중...</span>
          </div>
        )}
      </div>

      <Chat roomId={roomId} myRole={myRole} />

      <button className="btn btn-danger" onClick={handleLeave}>방 나가기</button>
    </div>
  )
}
