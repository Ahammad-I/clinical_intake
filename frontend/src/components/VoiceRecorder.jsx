import { useEffect, useState } from 'react'

/**
 * Mic button — hold to record, release to send.
 * Shows a pulsing ring while recording and a timer.
 */
export default function VoiceRecorder({ isRecording, onStart, onStop, disabled }) {
  const [seconds, setSeconds] = useState(0)

  // Timer while recording
  useEffect(() => {
    if (!isRecording) { setSeconds(0); return }
    const t = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [isRecording])

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div style={styles.wrapper}>
      {isRecording && (
        <span style={styles.timer}>{fmt(seconds)}</span>
      )}

      <button
        style={{
          ...styles.btn,
          background: isRecording
            ? 'var(--red)'
            : disabled ? 'var(--bg-raised)' : 'var(--bg-raised)',
          borderColor: isRecording ? 'var(--red)' : 'var(--border-light)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        title={isRecording ? 'Stop recording' : 'Start voice input'}
      >
        {/* Pulse ring when recording */}
        {isRecording && <span style={styles.pulse} />}

        {/* Icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke={isRecording ? '#fff' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="13" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <line x1="12" y1="21" x2="12" y2="17" />
          <line x1="9" y1="21" x2="15" y2="21" />
        </svg>
      </button>

      {isRecording && (
        <span style={styles.hint}>Recording… click to stop</span>
      )}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  btn: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: '1.5px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s ease',
    outline: 'none',
  },
  pulse: {
    position: 'absolute',
    inset: '-6px',
    borderRadius: '50%',
    border: '2px solid var(--red)',
    opacity: 0.5,
    animation: 'pulse-ring 1.2s ease-out infinite',
    pointerEvents: 'none',
  },
  timer: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--red)',
    letterSpacing: '0.05em',
    minWidth: '38px',
  },
  hint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
  },
}