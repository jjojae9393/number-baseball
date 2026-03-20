import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, push, set, onValue, onDisconnect, serverTimestamp, get } from 'firebase/database'
import { randomRoomName, getPlayerId } from '../utils'

const PLAYER_ID = getPlayerId()

export default function LobbyScreen({ onJoinRoom }) {
  const [rooms, setRooms] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [loading, setLoading] = useState(true)
  const nameInputRef = useRef(null)

  useEffect(() => {
    const roomsRef = ref(db, 'rooms')
    const unsub = onValue(roomsRef, (snap) => {
      const data = snap.val() || {}
      const cutoff = Date.now() - 2 * 60 * 60 * 1000

      const list = Object.entries(data)
        .filter(([, r]) => r.createdAt > cutoff && r.status !== 'ended')
        .sort((a, b) => b[1].createdAt - a[1].createdAt)

      setRooms(list)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    if (showCreateForm && nameInputRef.current) {
      nameInputRef.current.focus()
    }
  }, [showCreateForm])

  const createRoom = async () => {
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
    onJoinRoom(roomRef.key, 'p1', name)
  }

  const joinRoom = async (roomId) => {
    const p2Ref = ref(db, `rooms/${roomId}/p2`)
    await set(p2Ref, { pid: PLAYER_ID, ready: false })

    onDisconnect(p2Ref).remove()
    onDisconnect(ref(db, `rooms/${roomId}/status`)).set('waiting')

    const snap = await get(ref(db, `rooms/${roomId}/name`))
    const name = snap.val() || '방'
    onJoinRoom(roomId, 'p2', name)
  }

  return (
    <div className="screen">
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
                onKeyDown={(e) => e.key === 'Enter' && createRoom()}
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
          <div className="room-list-wrap">
            {rooms.map(([id, room]) => {
              const p2Exists = !!room.p2
              const isPlaying = room.status === 'playing'
              const canJoin = !p2Exists && !isPlaying

              return (
                <div
                  key={id}
                  className={`room-item ${canJoin ? '' : 'full'}`}
                  onClick={() => canJoin && joinRoom(id)}
                >
                  <div className="room-item-name">{room.name}</div>
                  <div className="room-meta">
                    <span className="room-count">{p2Exists ? '2' : '1'}/2명</span>
                    {isPlaying ? (
                      <span className="room-badge ing">진행중</span>
                    ) : p2Exists ? (
                      <span className="room-badge full">준비중</span>
                    ) : (
                      <span className="room-badge open">입장 가능</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
