import { useState, useRef, useCallback } from 'react'
import { db } from './firebase'
import { ref, update, remove } from 'firebase/database'
import LobbyScreen from './screens/LobbyScreen'
import RoomScreen from './screens/RoomScreen'
import PlayingScreen from './screens/PlayingScreen'
import EndedScreen from './screens/EndedScreen'

export default function App() {
  const [screen, setScreen] = useState('lobby')
  const [roomId, setRoomId] = useState(null)
  const [myRole, setMyRole] = useState(null)
  const [myNumber, setMyNumber] = useState('')
  const [roomName, setRoomName] = useState('')
  const [winner, setWinner] = useState(null)
  const [myGuessCount, setMyGuessCount] = useState(0)

  const listenersRef = useRef([])

  const goToRoom = useCallback((id, role, name) => {
    setRoomId(id)
    setMyRole(role)
    setRoomName(name)
    setScreen('room')
  }, [])

  const startGame = useCallback((number) => {
    setMyNumber(number)
    setScreen('playing')
  }, [])

  const endGame = useCallback((winnerRole, guessCount) => {
    setWinner(winnerRole)
    setMyGuessCount(guessCount)
    setScreen('ended')
  }, [])

  const backToLobby = useCallback(() => {
    setRoomId(null)
    setMyRole(null)
    setMyNumber('')
    setRoomName('')
    setWinner(null)
    setMyGuessCount(0)
    setScreen('lobby')
  }, [])

  const backToRoom = useCallback(async () => {
    if (!roomId) return
    // Reset game state in Firebase, keep players and chat
    await update(ref(db, `rooms/${roomId}`), {
      status: 'waiting',
      turn: 'p1',
      winner: null,
    })
    await update(ref(db, `rooms/${roomId}/p1`), { ready: false })
    await update(ref(db, `rooms/${roomId}/p2`), { ready: false })
    await remove(ref(db, `rooms/${roomId}/guesses`))

    setMyNumber('')
    setWinner(null)
    setMyGuessCount(0)
    setScreen('room')
  }, [roomId])

  return (
    <>
      <div className="header">
        <h1>⚾ 숫자야구</h1>
        {screen === 'lobby' && <p>방을 만들거나 참가하세요</p>}
      </div>

      {screen === 'lobby' && (
        <LobbyScreen onJoinRoom={goToRoom} />
      )}

      {screen === 'room' && (
        <RoomScreen
          roomId={roomId}
          myRole={myRole}
          roomName={roomName}
          onGameStart={startGame}
          onLeave={backToLobby}
          listenersRef={listenersRef}
        />
      )}

      {screen === 'playing' && (
        <PlayingScreen
          roomId={roomId}
          myRole={myRole}
          myNumber={myNumber}
          onGameEnd={endGame}
          listenersRef={listenersRef}
        />
      )}

      {screen === 'ended' && (
        <EndedScreen
          roomId={roomId}
          winner={winner}
          myRole={myRole}
          myNumber={myNumber}
          myGuessCount={myGuessCount}
          onBackToRoom={backToRoom}
          onLeave={backToLobby}
        />
      )}
    </>
  )
}
