/**
 * BriefPanel — shows two views:
 *  1. Live: structured collected_data filling in during the conversation
 *  2. Final: rendered ClinicalBrief once generated
 */

function SectionHeader({ icon, title, badge }) {
  return (
    <div style={sh.row}>
      <span style={sh.icon}>{icon}</span>
      <span style={sh.title}>{title}</span>
      {badge && <span style={sh.badge}>{badge}</span>}
    </div>
  )
}

const sh = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },
  icon: { fontSize: '15px' },
  title: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
  },
  badge: {
    fontSize: '10px',
    background: 'var(--mint-dim)',
    color: 'var(--mint)',
    padding: '2px 7px',
    borderRadius: '99px',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
  },
}

function DataField({ label, value }) {
  const hasValue = value && typeof value === 'string' && value.trim()
  return (
    <div style={df.row}>
      <span style={df.label}>{label}</span>
      <span style={{ ...df.value, color: hasValue ? 'var(--text-primary)' : 'var(--text-muted)' }}>
        {hasValue ? value : '—'}
      </span>
    </div>
  )
}

const df = {
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '6px 0',
    borderBottom: '1px solid var(--border)',
  },
  label: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.04em',
    flexShrink: 0,
    width: '90px',
    paddingTop: '1px',
  },
  value: {
    fontSize: '13px',
    lineHeight: '1.5',
    textAlign: 'right',
    flex: 1,
  },
}

function Section({ children }) {
  return (
    <div style={{
      background: 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '16px',
      marginBottom: '12px',
    }}>
      {children}
    </div>
  )
}

// ── Live view — data as it fills in ─────────────────────────────────────────
function LiveDataView({ collectedData }) {
  const cc  = collectedData?.cc  || {}
  const hpi = collectedData?.hpi || {}
  const ros = collectedData?.ros || {}

  const ccCount  = Object.values(cc).filter(Boolean).length
  const hpiCount = Object.values(hpi).filter(Boolean).length
  const rosCount = Object.values(ros).filter(Boolean).length

  return (
    <>
      <Section>
        <SectionHeader icon="💬" title="Chief Complaint"
          badge={ccCount > 0 ? `${ccCount} field${ccCount !== 1 ? 's' : ''}` : null} />
        <DataField label="complaint" value={cc.complaint} />
        <DataField label="duration"  value={cc.duration}  />
      </Section>

      <Section>
        <SectionHeader icon="📋" title="History of Present Illness"
          badge={hpiCount > 0 ? `${hpiCount}/7` : null} />
        <DataField label="onset"       value={hpi.onset}       />
        <DataField label="location"    value={hpi.location}    />
        <DataField label="character"   value={hpi.character}   />
        <DataField label="severity"    value={hpi.severity}    />
        <DataField label="duration"    value={hpi.duration}    />
        <DataField label="aggravating" value={hpi.aggravating} />
        <DataField label="relieving"   value={hpi.relieving || hpi.alleviating} />
      </Section>

      <Section>
        <SectionHeader icon="🔍" title="Review of Systems"
          badge={rosCount > 0 ? `${rosCount} systems` : null} />
        {rosCount === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Not yet started — will begin after HPI
          </p>
        ) : (
          Object.entries(ros).map(([key, val]) => (
            <DataField key={key} label={key.replace(/_/g, ' ')} value={val} />
          ))
        )}
      </Section>
    </>
  )
}

// ── Final brief view ─────────────────────────────────────────────────────────
function FinalBriefView({ brief }) {
  return (
    <>
      {/* Chief Complaint */}
      <Section>
        <SectionHeader icon="💬" title="Chief Complaint" badge="complete" />
        <p style={{ fontSize: '14px', lineHeight: '1.7', color: 'var(--text-primary)' }}>
          {brief.chief_complaint}
        </p>
      </Section>

      {/* HPI */}
      <Section>
        <SectionHeader icon="📋" title="History of Present Illness" badge="complete" />
        {Object.entries(brief.hpi || {}).map(([key, val]) => (
          <DataField key={key} label={key} value={val} />
        ))}
      </Section>

      {/* ROS */}
      <Section>
        <SectionHeader icon="🔍" title="Review of Systems" badge="complete" />
        {Object.entries(brief.ros || {}).map(([key, val]) => (
          <DataField key={key} label={key} value={val} />
        ))}
      </Section>

      {/* Raw EHR note */}
      {brief.raw_text && (
        <Section>
          <SectionHeader icon="📄" title="EHR Note (raw)" />
          <pre style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: '1.7',
            margin: 0,
          }}>
            {brief.raw_text}
          </pre>
        </Section>
      )}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BriefPanel({ collectedData, brief, loading }) {
  const showFinal = !!brief

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.title}>
            {showFinal ? 'Clinical Brief' : 'Live Intake Data'}
          </div>
          <div style={styles.subtitle}>
            {showFinal
              ? 'Generated — ready for physician review'
              : 'Fields update as the patient responds'}
          </div>
        </div>
        {showFinal && (
          <div style={styles.completeBadge}>✓ Complete</div>
        )}
        {!showFinal && loading && (
          <div style={styles.liveDot}>● Live</div>
        )}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {showFinal
          ? <FinalBriefView brief={brief} />
          : <LiveDataView collectedData={collectedData} />
        }
      </div>
    </div>
  )
}

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-base)',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '0.01em',
  },
  subtitle: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    marginTop: '2px',
    fontFamily: 'var(--font-mono)',
  },
  completeBadge: {
    fontSize: '11px',
    background: 'var(--mint-dim)',
    color: 'var(--mint)',
    padding: '4px 10px',
    borderRadius: '99px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
  },
  liveDot: {
    fontSize: '11px',
    color: 'var(--accent)',
    fontFamily: 'var(--font-mono)',
    animation: 'livePulse 2s ease-in-out infinite',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
  },
}