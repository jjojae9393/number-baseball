export default function EndedScreen({ winner, myRole, myNumber, myGuessCount, onBackToLobby }) {
  const won = winner === myRole

  return (
    <div className="screen">
      <div className="card">
        <div className="result-banner">
          <div className="big">{won ? '🎉' : '😢'}</div>
          <h2>{won ? '승리!' : '패배...'}</h2>
          <p>
            {won
              ? `${myGuessCount}번 만에 상대방의 숫자를 맞혔습니다!`
              : `상대방이 먼저 맞혔습니다.\n내 숫자는 ${myNumber}이었습니다.`
            }
          </p>
          <button className="btn btn-primary" onClick={onBackToLobby}>
            로비로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
