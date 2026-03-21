import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, set, onValue } from 'firebase/database'
import { validateNum } from '../utils'
import Chat from '../components/Chat'

interface SystemMsg {
  key: string
  sender: string
  text: string
  ts: number
}

interface RoomScreenProps {
  roomId: string
  myRole: string
  roomName: string
  onGameStart: (number: string) => void
  onLeave: () => void
}

export default function RoomScreen({ roomId, myRole, roomName, onGameStart, onLeave }: RoomScreenProps) {
  const [myReady, setMyReady] = useState(false)
  const [oppStatus, setOppStatus] = useState<'absent' | 'waiting' | 'ready'>('absent')
  const [numInput, setNumInput] = useState('')
  const [error, setError] = useState('')
  const [systemMsgs, setSystemMsgs] = useState<SystemMsg[]>([])
  const [currentName, setCurrentName] = useState(roomName)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(roomName)
  const gameStartedRef = useRef(false)
  const numInputRef = useRef('')
  const prevOppRef = useRef<boolean | null>(null)

  // Keep ref in sync with state
  useEffect(() => { numInputRef.current = numInput }, [numInput])

  useEffect(() => {
    gameStartedRef.current = false
    prevOppRef.current = null
    setMyReady(false)
    setNumInput('')
    setError('')
    setSystemMsgs([])

    const roomRef = ref(db, `rooms/${roomId}`)

    const unsub = onValue(roomRef, (snap) => {
      const room = snap.val()
      if (!room || room.status === 'ended') {
        if (!gameStartedRef.current) {
          if (myRole === 'p2') alert('방장이 방을 닫았습니다.')
          onLeave()
        }
        return
      }

      const oppRole = myRole === 'p1' ? 'p2' : 'p1'
      const oppData = room[oppRole]
      const wasPresent = prevOppRef.current
      const isPresent = !!oppData

      // Detect join/leave and add local system message
      if (wasPresent !== null && wasPresent !== isPresent) {
        const msg: SystemMsg = {
          key: 'sys-' + Date.now(),
          sender: 'system',
          text: isPresent ? '상대방이 입장했습니다.' : '상대방이 퇴장했습니다.',
          ts: Date.now(),
        }
        setSystemMsgs(prev => [...prev, msg])
      }
      prevOppRef.current = isPresent

      if (!oppData) {
        setOppStatus('absent')
      } else if (oppData.ready) {
        setOppStatus('ready')
      } else {
        setOppStatus('waiting')
      }

      // Sync room name
      if (room.name) setCurrentName(room.name)

      // Reset my ready state if room was reset
      const myData = room[myRole]
      if (myData && !myData.ready) {
        setMyReady(false)
      }

      // Both ready → start game
      if (room.p1?.ready && room.p2?.ready && !gameStartedRef.current) {
        gameStartedRef.current = true
        onGameStart(numInputRef.current)
      }
    })

    return () => unsub()
  }, [roomId, myRole, onGameStart, onLeave])

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

  const handleUnready = () => {
    setMyReady(false)
    setNumInput('')
    set(ref(db, `rooms/${roomId}/${myRole}/ready`), false)
  }

  const handleLeave = () => {
    onLeave()
  }

  const isHost = myRole === 'p1'

  const handleEditToggle = () => {
    if (editing) {
      const name = editName.trim()
      if (name && name !== currentName) {
        set(ref(db, `rooms/${roomId}/name`), name)
      }
      setEditing(false)
    } else {
      setEditName(currentName)
      setEditing(true)
    }
  }

  return (
    <div className="screen">
      <div className="card title-bar">
        {editing ? (
          <input
            className="title-bar-input"
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleEditToggle()}
            maxLength={20}
            autoFocus
          />
        ) : (
          <div className="title-bar-name">{currentName}</div>
        )}
        <div className="title-bar-actions">
          {isHost && (
            <button className="btn-title-action" onClick={handleEditToggle} title={editing ? '수정완료' : '방 이름 수정'}>
              {editing ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              )}
            </button>
          )}
          <button className="btn-exit" onClick={handleLeave} title="방 나가기">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
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
              className="input input-mono"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="000"
              autoComplete="off"
              maxLength={3}
              value={numInput}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 3)
                setNumInput(digits)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleReady()
              }}
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
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={handleUnready}>
              다시 입력
            </button>
          </div>
        )}
      </div>

      <Chat roomId={roomId} myRole={myRole} systemMsgs={systemMsgs} />
    </div>
  )
}
