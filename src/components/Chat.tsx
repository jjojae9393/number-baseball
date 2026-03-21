import { useState, useEffect, useRef } from 'react'
import { db } from '../firebase'
import { ref, push, onChildAdded, serverTimestamp } from 'firebase/database'

interface ChatMessage {
  key: string
  sender: string
  text: string
  ts?: number
}

interface ChatProps {
  roomId: string
  myRole: string
  systemMsgs?: ChatMessage[]
}

export default function Chat({ roomId, myRole, systemMsgs = [] }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  useEffect(() => {
    messagesRef.current = []
    setMessages([])
    const joinedAt = Date.now()

    const chatRef = ref(db, `rooms/${roomId}/chat`)
    const unsub = onChildAdded(chatRef, (snap) => {
      const msg = snap.val()
      // Only show messages after join time
      if (msg.ts && msg.ts < joinedAt) return
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

  // Scroll when system messages arrive
  useEffect(() => {
    if (systemMsgs.length > 0 && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [systemMsgs.length])

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
        {messages.length === 0 && systemMsgs.length === 0 ? (
          <div className="empty-hint">메시지가 없습니다</div>
        ) : (
          [...messages, ...systemMsgs].sort((a, b) => (a.ts || 0) - (b.ts || 0)).map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.key} className="chat-msg system">
                  <span className="chat-system">{msg.text}</span>
                </div>
              )
            }
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
