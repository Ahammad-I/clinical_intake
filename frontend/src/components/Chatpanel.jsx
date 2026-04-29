import { useState, useEffect, useRef } from 'react'
import VoiceRecorder from './VoiceRecorder'

/** Formats ISO timestamp → "10:42 AM" */
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ msg }) {
  const isAgent = msg.role === 'agent'
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: isAgent ? 'flex-start' : 'flex-end',
      gap: '4px',
    }}>
      {/* Role label */}
      <span style={{
        fontSize: '11px',
        color: 'var(--text-muted)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontFamily: 'var(--font-mono)',
        paddingLeft: isAgent ? '4px' : 0,
        paddingRight: isAgent ? 0 : '4px',
      }}>
        {isAgent ? 'Intake Nurse' : msg.was_transcribed ? '🎙 You (voice)' : 'You'}
      </span>

      <div style={{
        maxWidth: '80%',
        padding: '11px 15px',
        borderRadius: isAgent
          ? '4px 14px 14px 14px'
          : '14px 4px 14px 14px',
        background: isAgent ? 'var(--bg-raised)' : 'var(--accent-dim)',
        border: `1px solid ${isAgent ? 'var(--border)' : 'rgba(14,165,233,0.25)'}`,
        color: isAgent ? 'var(--text-primary)' : 'var(--text-primary)',
        fontSize: '14px',
        lineHeight: '1.65',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>

      <span style={{
        fontSize: '10px',
        color: 'var(--text-muted)',
        paddingLeft: isAgent ? '4px' : 0,
        paddingRight: isAgent ? 0 : '4px',
        fontFamily: 'var(--font-mono)',
      }}>
        {msg.timestamp ? fmtTime(msg.timestamp) : ''}
      </span>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', flexDirection: 'column' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', paddingLeft: '4px' }}>
        Intake Nurse
      </span>
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: '4px 14px 14px 14px',
        display: 'flex',
        gap: '5px',
        alignItems: 'center',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--text-muted)',
            display: 'inline-block',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

export default function ChatPanel({
  messages, loading, isComplete, isRecording, error,
  onSend, onStartRecording, onStopRecording, onGenerateBrief,
  briefGenerated,
}) {
  const [input,     setInput]     = useState('')
  const bottomRef   = useRef(null)
  const inputRef    = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = () => {
    const text = input.trim()
    if (!text || loading) return
    onSend(text)
    setInput('')
    inputRef.current?.focus()
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canInput = !loading && !isRecording

  return (
    <div style={styles.panel}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.statusDot} />
          <div>
            <div style={styles.headerTitle}>Clinical Intake Conversation</div>
            <div style={styles.headerSub}>
              {isComplete ? 'Intake complete — brief ready' : 'Nurse agent is active'}
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <span style={styles.msgCount}>{messages.length} messages</span>
        )}
      </div>

      {/* ── Messages ── */}
      <div style={styles.messages}>
        {messages.length === 0 && !loading && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🏥</div>
            <p>Starting your intake session…</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {loading && <TypingIndicator />}

        {/* Error banner */}
        {error && (
          <div style={styles.errorBanner}>{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Brief generate button (shows when ROS/done phase reached) ── */}
      {(isComplete || messages.some(m => m.role === 'agent' && messages.length > 8)) && !briefGenerated && (
        <div style={styles.briefPrompt}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {isComplete ? 'All intake questions answered.' : 'Ready to generate a brief?'}
          </span>
          <button
            style={styles.briefBtn}
            onClick={onGenerateBrief}
            disabled={loading}
          >
            Generate Clinical Brief →
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      {!isComplete && (
        <div style={styles.inputBar}>
          <VoiceRecorder
            isRecording={isRecording}
            onStart={onStartRecording}
            onStop={onStopRecording}
            disabled={loading}
          />

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Type your response… (Enter to send)"
            disabled={!canInput}
            rows={1}
            style={{
              ...styles.textarea,
              opacity: canInput ? 1 : 0.5,
            }}
          />

          <button
            style={{
              ...styles.sendBtn,
              opacity: (input.trim() && canInput) ? 1 : 0.35,
              cursor:  (input.trim() && canInput) ? 'pointer' : 'default',
            }}
            onClick={handleSend}
            disabled={!input.trim() || !canInput}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      )}

      {isComplete && briefGenerated && (
        <div style={styles.completeBar}>
          <span>✓ Intake complete — see the brief on the right</span>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%            { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  statusDot: {
    width: 9, height: 9, borderRadius: '50%',
    background: 'var(--mint)',
    boxShadow: '0 0 0 3px var(--mint-dim)',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
  },
  headerSub: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '1px',
    fontFamily: 'var(--font-mono)',
  },
  msgCount: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border)',
    padding: '3px 8px',
    borderRadius: '99px',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  emptyState: {
    textAlign: 'center',
    color: 'var(--text-muted)',
    marginTop: '60px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
  },
  emptyIcon: {
    fontSize: '36px',
  },
  errorBanner: {
    background: 'var(--red-dim)',
    border: '1px solid var(--red)',
    color: '#fca5a5',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
  },
  briefPrompt: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'var(--bg-raised)',
    flexShrink: 0,
    gap: '12px',
  },
  briefBtn: {
    background: 'var(--mint)',
    color: '#fff',
    border: 'none',
    padding: '8px 16px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
    letterSpacing: '0.02em',
    flexShrink: 0,
  },
  inputBar: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '10px',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  },
  textarea: {
    flex: 1,
    background: 'var(--bg-raised)',
    border: '1.5px solid var(--border-light)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    padding: '10px 14px',
    resize: 'none',
    outline: 'none',
    lineHeight: '1.5',
    minHeight: '42px',
    maxHeight: '120px',
    overflowY: 'auto',
    transition: 'border-color 0.2s',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 'var(--radius-sm)',
    background: 'var(--accent)',
    border: 'none',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.2s',
  },
  completeBar: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    background: 'var(--mint-dim)',
    color: 'var(--mint)',
    fontSize: '13px',
    fontWeight: 500,
    textAlign: 'center',
    letterSpacing: '0.02em',
    flexShrink: 0,
  },
}