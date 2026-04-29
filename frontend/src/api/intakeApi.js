import axios from 'axios'

const api = axios.create({
  baseURL: '/api/intake',
  headers: { 'Content-Type': 'application/json' },
})

/* ── Sessions ─────────────────────────────────────────────────────────── */

/** Create a brand-new intake session. Returns full session + opening message. */
export const createSession = () =>
  api.post('/sessions/').then(r => r.data)

/** Fetch a session by UUID — includes all messages + brief. */
export const getSession = (sessionId) =>
  api.get(`/sessions/${sessionId}/`).then(r => r.data)

/** List all sessions (lightweight, no messages). */
export const listSessions = () =>
  api.get('/sessions/').then(r => r.data)

/** Delete a session permanently. */
export const deleteSession = (sessionId) =>
  api.delete(`/sessions/${sessionId}/`)

/* ── Conversation ─────────────────────────────────────────────────────── */

/**
 * Send a text message from the patient.
 * Returns { reply, current_phase, is_complete, collected_data, message }
 */
export const sendMessage = (sessionId, content) =>
  api.post(`/sessions/${sessionId}/message/`, { content }).then(r => r.data)

/**
 * Upload an audio blob for Whisper transcription.
 * The backend transcribes → runs agent → returns same shape as sendMessage
 * plus { transcript }.
 */
export const transcribeAudio = (sessionId, audioBlob) => {
  const form = new FormData()
  // Some browsers produce audio/webm, others audio/ogg — both work with ffmpeg
  const ext  = audioBlob.type.includes('ogg') ? 'ogg' : 'webm'
  form.append('audio', audioBlob, `recording.${ext}`)
  return api.post(
    `/sessions/${sessionId}/transcribe/`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ).then(r => r.data)
}

/* ── Brief ────────────────────────────────────────────────────────────── */

/** Trigger brief generation. Returns ClinicalBrief object. */
export const generateBrief = (sessionId) =>
  api.post(`/sessions/${sessionId}/generate-brief/`).then(r => r.data)

/** Fetch an already-generated brief. */
export const getBrief = (sessionId) =>
  api.get(`/sessions/${sessionId}/brief/`).then(r => r.data)