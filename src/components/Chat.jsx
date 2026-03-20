import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, push, onChildAdded, serverTimestamp } from 'firebase/database'

export default function Chat({ roomId, myRole }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const listRef = useRef(null)
  const messagesRef = useRef([])

  useEffect(() => {
    messagesRef.current = []
    setMessages([])

    const chatRef = ref(db, `rooms/${roomId}/chat`)
    const unsub = onChildAdded(chatRef, (snap) => {
      const msg = snap.val()
      if (!messagesRef.current.find(m => m.key === snap.key)) {
        messagesRef.current = [...messagesRef.current, { key: snap.key, ...msg }]
        setMessages([...messagesRef.current])
        setTimeout(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
        }, 50)
      }
    })

    return () => unsub()
  }, [roomId])

  const send = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    push(ref(db, `rooms/${roomId}/chat`), {
      sender: myRole,
      text,
      ts: serverTimestamp(),
    })
  }

  return (
    <div className="card chat-card">
      <div className="card-title">채팅</div>
      <div className="chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="empty-hint">메시지가 없습니다</div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === myRole
            return (
              <div key={msg.key} className={`chat-msg ${isMe ? 'me' : 'opp'}`}>
                <span className="chat-label">{isMe ? '나' : '상대'}</span>
                <span className="chat-text">{msg.text}</span>
              </div>
            )
          })
        )}
      </div>
      <div className="chat-input-row">
        <input
          className="input"
          type="text"
          placeholder="메시지 입력..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()}
          maxLength={100}
        />
        <button className="btn btn-primary btn-sm" onClick={send}>전송</button>
      </div>
    </div>
  )
}
