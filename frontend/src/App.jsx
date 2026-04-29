import { useIntakeSession } from './hooks/useIntakeSession'
import ProgressBar from './components/ProgressBar'
import ChatPanel   from './components/ChatPanel'
import BriefPanel  from './components/BriefPanel'

// ── Welcome / landing screen ─────────────────────────────────────────────────
function WelcomeScreen({ onStart, loading }) {
  return (
    <div style={ws.overlay}>
      {/* Background grid */}
      <div style={ws.grid} />

      <div style={ws.card}>
        {/* Logo mark */}
        <div style={ws.logoMark}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="var(--accent)" opacity="0.15"/>
            <path d="M16 6v20M6 16h20" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="16" cy="16" r="5" stroke="var(--accent)" strokeWidth="2" fill="none"/>
          </svg>
        </div>

        <h1 style={ws.heading}>Clinical Intake Agent</h1>
        <p style={ws.sub}>
          A pre-visit AI nurse will guide you through a structured interview —
          Chief Complaint, History of Present Illness, and Review of Systems.
          A clinical brief will be generated for your physician.
        </p>

        {/* Feature chips */}
        <div style={ws.chips}>
          {['💬 Chat or voice input', '📋 OLD CARTS framework', '📄 Auto EHR brief'].map(c => (
            <span key={c} style={ws.chip}>{c}</span>
          ))}
        </div>

        <button
          style={{ ...ws.btn, opacity: loading ? 0.6 : 1 }}
          onClick={onStart}
          disabled={loading}
        >
          {loading ? 'Starting…' : 'Begin Intake →'}
        </button>

        <p style={ws.disclaimer}>
          This is a demo tool. Do not enter real patient information.
        </p>
      </div>
    </div>
  )
}

const ws = {
  overlay: {
    position: 'fixed', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg-base)',
    zIndex: 10,
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    opacity: 0.4,
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-xl)',
    padding: '44px 48px',
    maxWidth: '460px',
    width: '90%',
    textAlign: 'center',
    boxShadow: 'var(--shadow-lg)',
  },
  logoMark: {
    display: 'flex', justifyContent: 'center', marginBottom: '20px',
  },
  heading: {
    fontSize: '26px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    marginBottom: '14px',
    fontFamily: 'var(--font-ui)',
  },
  sub: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.7',
    marginBottom: '24px',
  },
  chips: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '8px',
    marginBottom: '28px',
  },
  chip: {
    fontSize: '12px',
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-light)',
    color: 'var(--text-secondary)',
    padding: '5px 12px',
    borderRadius: '99px',
    letterSpacing: '0.02em',
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '14px 0',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    marginBottom: '18px',
    transition: 'opacity 0.2s, transform 0.1s',
  },
  disclaimer: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
  },
}

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const {
    session, messages, brief, collectedData,
    loading, error, isRecording,
    startSession, send,
    startRecording, stopRecording,
    requestBrief, clearError,
  } = useIntakeSession()

  const showWelcome = !session

  return (
    <div style={app.root}>
      {showWelcome && (
        <WelcomeScreen onStart={startSession} loading={loading} />
      )}

      {session && (
        <div style={app.layout}>
          {/* ── Top bar ── */}
          <div style={app.topBar}>
            {/* Brand */}
            <div style={app.brand}>
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <path d="M16 4v24M4 16h24" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="16" cy="16" r="7" stroke="var(--accent)" strokeWidth="2" fill="none"/>
              </svg>
              <span style={app.brandName}>ClinicalIntake</span>
            </div>

            {/* Progress */}
            <div style={{ flex: 1 }}>
              <ProgressBar currentPhase={session.current_phase} />
            </div>

            {/* Session ID */}
            <div style={app.sessionBadge}>
              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>SESSION</span>
              <span style={app.sessionId}>{session.id.slice(0, 8)}…</span>
            </div>
          </div>

          {/* ── Split pane ── */}
          <div style={app.panes}>
            {/* Left — Chat */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              <ChatPanel
                messages={messages}
                loading={loading}
                isComplete={session.is_complete}
                isRecording={isRecording}
                error={error}
                onSend={send}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onGenerateBrief={requestBrief}
                briefGenerated={!!brief}
              />
            </div>

            {/* Divider */}
            <div style={app.divider} />

            {/* Right — Brief */}
            <div style={{ width: '42%', flexShrink: 0, overflow: 'hidden' }}>
              <BriefPanel
                collectedData={collectedData}
                brief={brief}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const app = {
  root: {
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-base)',
  },
  layout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  topBar: {
    display: 'flex',
    alignItems: 'stretch',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    flexShrink: 0,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 20px',
    borderRight: '1px solid var(--border)',
    flexShrink: 0,
  },
  brandName: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
    whiteSpace: 'nowrap',
  },
  sessionBadge: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-end',
    padding: '0 20px',
    borderLeft: '1px solid var(--border)',
    gap: '2px',
    flexShrink: 0,
  },
  sessionId: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    letterSpacing: '0.04em',
  },
  panes: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  divider: {
    width: '1px',
    background: 'var(--border)',
    flexShrink: 0,
  },
}