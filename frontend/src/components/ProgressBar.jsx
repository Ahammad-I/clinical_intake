import React from 'react'

const PHASES = [
  { key: 'cc',   label: 'Chief Complaint', short: 'CC'  },
  { key: 'hpi',  label: 'History of Illness', short: 'HPI' },
  { key: 'ros',  label: 'Review of Systems', short: 'ROS' },
  { key: 'done', label: 'Complete',           short: '✓'   },
]

const ORDER = ['cc', 'hpi', 'ros', 'done']

export default function ProgressBar({ currentPhase }) {
  const currentIdx = ORDER.indexOf(currentPhase)

  return (
    <div style={styles.wrapper}>
      {PHASES.map((phase, idx) => {
        const isDone    = idx < currentIdx
        const isActive  = idx === currentIdx
        const isPending = idx > currentIdx

        return (
          <React.Fragment key={phase.key}>
            {/* Step node */}
            <div style={styles.step}>
              <div style={{
                ...styles.circle,
                background:   isDone   ? 'var(--mint)'
                            : isActive ? 'var(--accent)'
                            : 'var(--bg-raised)',
                border: `2px solid ${
                    isDone   ? 'var(--mint)'
                  : isActive ? 'var(--accent)'
                  : 'var(--border-light)'
                }`,
                boxShadow: isActive ? '0 0 0 4px var(--accent-dim)' : 'none',
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.35s ease',
              }}>
                <span style={{
                  ...styles.circleText,
                  color: (isDone || isActive) ? '#fff' : 'var(--text-muted)',
                  fontSize: isDone ? '11px' : '10px',
                }}>
                  {isDone ? '✓' : phase.short}
                </span>
              </div>

              <div style={styles.labelBox}>
                <span style={{
                  ...styles.labelMain,
                  color: isDone   ? 'var(--mint)'
                       : isActive ? 'var(--accent)'
                       : 'var(--text-muted)',
                }}>
                  {phase.label}
                </span>
                {isActive && (
                  <span style={styles.activePill}>In progress</span>
                )}
              </div>
            </div>

            {/* Connector line */}
            {idx < PHASES.length - 1 && (
              <div style={{
                ...styles.connector,
                background: idx < currentIdx
                  ? 'linear-gradient(90deg, var(--mint), var(--accent))'
                  : 'var(--border)',
              }} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    padding: '18px 28px',
    background: 'var(--bg-surface)',
    borderBottom: '1px solid var(--border)',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexShrink: 0,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    flexShrink: 0,
  },
  circleText: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  labelBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  labelMain: {
    fontSize: '12px',
    fontWeight: 500,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
  },
  activePill: {
    fontSize: '10px',
    background: 'var(--accent-dim)',
    color: 'var(--accent)',
    padding: '1px 6px',
    borderRadius: '99px',
    letterSpacing: '0.04em',
    fontFamily: 'var(--font-mono)',
  },
  connector: {
    flex: 1,
    height: '2px',
    minWidth: '20px',
    margin: '0 8px',
    borderRadius: '2px',
    transition: 'background 0.5s ease',
  },
}