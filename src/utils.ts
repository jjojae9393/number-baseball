export function calcResult(secret: string, guess: string): { strike: number; ball: number } {
  let s = 0, b = 0
  for (let i = 0; i < 3; i++) {
    if (secret[i] === guess[i]) s++
    else if (secret.includes(guess[i])) b++
  }
  return { strike: s, ball: b }
}

export function validateNum(s: string): string | null {
  if (!/^\d{3}$/.test(s)) return '3자리 숫자를 입력해주세요'
  if (s[0] === '0') return '첫 자리는 0이 될 수 없습니다'
  return null
}

const ROOM_ADJ = ['빠른','용감한','조용한','신나는','멋진','강한','날쌘','예리한']
const ROOM_NOUN = ['독수리','호랑이','사자','늑대','여우','판다','매','상어']

export function randomRoomName(): string {
  return ROOM_ADJ[Math.random() * ROOM_ADJ.length | 0] + ' ' + ROOM_NOUN[Math.random() * ROOM_NOUN.length | 0] + '의 방'
}

export function getPlayerId(): string {
  let id = sessionStorage.getItem('nb_pid')
  if (!id) {
    id = Math.random().toString(36).slice(2, 10)
    sessionStorage.setItem('nb_pid', id)
  }
  return id
}
