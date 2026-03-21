import { useState, useEffect, useRef, useMemo } from 'react'
import { db } from '../firebase'
import { ref, push, set, onValue, onDisconnect, serverTimestamp, get } from 'firebase/database'
import { randomRoomName, getPlayerId } from '../utils'

const PLAYER_ID = getPlayerId()

interface RoomData {
  name: string
  status: string
  createdAt: number
  p1?: { pid: string; ready: boolean } | null
  p2?: { pid: string; ready: boolean } | null
}

interface LobbyScreenProps {
  onJoinRoom: (roomId: string, role: string, name: string) => void
}

export default function LobbyScreen({ onJoinRoom }: LobbyScreenProps) {
  const [rooms, setRooms] = useState<[string, RoomData][]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [shuffleKey, setShuffleKey] = useState(0)
  const [showHelp, setShowHelp] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const allRoomsRef = useRef<[string, RoomData][]>([])

  useEffect(() => {
    const roomsRef = ref(db, 'rooms')
    const unsub = onValue(roomsRef, (snap) => {
      const data = snap.val() || {}
      const cutoff = Date.now() - 2 * 60 * 60 * 1000

      const list = (Object.entries(data) as [string, RoomData][])
        .filter(([, r]) => r.createdAt > cutoff && r.status !== 'ended' && r.status !== 'playing' && (!r.p1 || !r.p2))
        .sort((a, b) => b[1].createdAt - a[1].createdAt)

      allRoomsRef.current = list
      setRooms(list)
      setLoading(false)
      setShuffleKey(prev => prev + 1)
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    if (showCreateForm && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [showCreateForm])

  const createRoom = async () => {
    if (joining) return
    setJoining(true)

    try {
      const name = newRoomName.trim() || randomRoomName()
      const roomRef = push(ref(db, 'rooms'))

      await set(roomRef, {
        name,
        status: 'waiting',
        createdAt: serverTimestamp(),
        turn: 'p1',
        winner: null,
        p1: { pid: PLAYER_ID, ready: false },
        p2: null,
      })

      onDisconnect(roomRef).update({ status: 'ended' })
      onJoinRoom(roomRef.key!, 'p1', name)
    } catch {
      setJoining(false)
    }
  }

  // Shuffle and pick 5 rooms
  const shuffled = useMemo(() => {
    const arr = [...rooms]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.random() * (i + 1) | 0;
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr.slice(0, 5)
  }, [rooms, shuffleKey])

  const hasMore = rooms.length > 5

  const reshuffle = () => setShuffleKey(prev => prev + 1)

  const joinRoom = async (roomId: string) => {
    if (joining) return
    setJoining(true)

    try {
      // Check if room is still joinable
      const roomSnap = await get(ref(db, `rooms/${roomId}`))
      const room = roomSnap.val() as RoomData | null
      if (!room || (room.p1 && room.p2) || room.status === 'playing' || room.status === 'ended') {
        alert('이미 입장할 수 없는 방입니다.')
        setJoining(false)
        return
      }

      // Join the empty slot
      const role = !room.p1 ? 'p1' : 'p2'
      const playerRef = ref(db, `rooms/${roomId}/${role}`)
      await set(playerRef, { pid: PLAYER_ID, ready: false })

      onDisconnect(playerRef).remove()
      onDisconnect(ref(db, `rooms/${roomId}/status`)).set('waiting')

      const name = room.name || '방'
      onJoinRoom(roomId, role, name)
    } catch {
      setJoining(false)
    }
  }

  return (
    <div className="screen">
      <button className="btn btn-ghost" onClick={() => setShowHelp(true)}>
        게임 방법 알아보기
      </button>

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">게임 방법</div>
            <div className="modal-body">
              <p><strong>1. 숫자 정하기</strong><br />서로 3자리 비밀 숫자를 정합니다.<br />첫 자리는 0이 될 수 없고, 중복은 허용됩니다.</p>
              <p><strong>2. 번갈아 추측하기</strong><br />내 차례에 상대의 숫자를 추측합니다.<br />1턴에 60초의 시간 제한이 있습니다.</p>
              <p><strong>3. 결과 확인</strong><br />
                <span className="g-s">S (스트라이크)</span> — 숫자와 위치 모두 맞음<br />
                <span className="g-b">B (볼)</span> — 숫자는 맞지만 위치가 다름<br />
                <span style={{color: 'var(--muted)'}}>OUT</span> — 맞는 숫자가 하나도 없음
              </p>
              <p><strong>4. 승리 조건</strong><br />먼저 3S(3스트라이크)를 달성하면 승리!</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowHelp(false)}>확인</button>
          </div>
        </div>
      )}

      {/* Create room */}
      <div className="card">
        {!showCreateForm ? (
          <button className="btn btn-primary" onClick={() => setShowCreateForm(true)}>
            + 방 만들기
          </button>
        ) : (
          <div style={{ marginTop: 0 }}>
            <div className="field-group">
              <input
                ref={nameInputRef}
                className="input"
                type="text"
                placeholder="방 이름 (비우면 자동 생성)"
                maxLength={20}
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && createRoom()}
              />
              <button className="btn btn-success btn-sm" onClick={createRoom}>만들기</button>
            </div>
          </div>
        )}
      </div>

      {/* Room list */}
      <div className="card" style={{ flex: 1 }}>
        <div className="card-title">
          열린 방 목록
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner" />
            불러오는 중...
          </div>
        ) : rooms.length === 0 ? (
          <div className="empty-hint">
            열린 방이 없습니다.<br />방을 만들어 친구를 초대하세요!
          </div>
        ) : (
          <>
            <div className="room-list-wrap">
              {shuffled.map(([id, room]) => (
                <div
                  key={id}
                  className="room-item"
                  onClick={() => joinRoom(id)}
                >
                  <div className="room-item-name">{room.name}</div>
                  <div className="room-meta">
                    <span className="room-count">1/2명</span>
                    <span className="room-badge open">입장 가능</span>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={reshuffle}>
                다른 방 보기
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
