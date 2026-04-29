import { useState, useCallback, useRef } from 'react'
import {
  createSession, sendMessage, transcribeAudio, generateBrief
} from '../api/intakeApi'

/**
 * Central state hook for one intake session.
 *
 * Exposes:
 *   session        — full session object (id, current_phase, is_complete, …)
 *   messages       — array of { id, role, content, timestamp, was_transcribed }
 *   brief          — ClinicalBrief object once generated
 *   collectedData  — running { cc, hpi, ros } JSON
 *   loading        — true while waiting for agent reply
 *   error          — last error string, or null
 *   isRecording    — true while MediaRecorder is active
 *
 *   startSession() — creates a new session, loads the greeting
 *   send(text)     — send a typed message
 *   startRecording / stopRecording — voice input
 *   requestBrief() — trigger brief generation
 */
export function useIntakeSession() {
  const [session,       setSession]       = useState(null)
  const [messages,      setMessages]      = useState([])
  const [brief,         setBrief]         = useState(null)
  const [collectedData, setCollectedData] = useState({ cc: {}, hpi: {}, ros: {} })
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [isRecording,   setIsRecording]   = useState(false)

  // MediaRecorder refs
  const mediaRecorderRef = useRef(null)
  const audioChunksRef   = useRef([])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const clearError = () => setError(null)

  /** Append a single message to the list */
  const appendMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg])
  }, [])

  /** Apply the agent response — update phase, collected data, append agent message */
  const applyAgentResponse = useCallback((data) => {
    setSession(prev => prev
      ? { ...prev, current_phase: data.current_phase, is_complete: data.is_complete }
      : prev
    )
    if (data.collected_data) setCollectedData(data.collected_data)
    if (data.message)        appendMessage(data.message)
  }, [appendMessage])

  // ── Public actions ─────────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const newSession = await createSession()
      setSession(newSession)
      setMessages(newSession.messages || [])
      setCollectedData(newSession.collected_data || { cc: {}, hpi: {}, ros: {} })
      setBrief(null)
    } catch (err) {
      setError('Could not start a session. Is the Django server running?')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const send = useCallback(async (text) => {
    if (!session || !text.trim()) return
    clearError()

    // Optimistically show the user's message immediately
    const optimistic = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
      was_transcribed: false,
    }
    appendMessage(optimistic)
    setLoading(true)

    try {
      const data = await sendMessage(session.id, text.trim())
      applyAgentResponse(data)
    } catch (err) {
      setError('Failed to send message. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [session, appendMessage, applyAgentResponse])

  const startRecording = useCallback(async () => {
    if (!session) return
    clearError()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setIsRecording(true)
    } catch (err) {
      setError('Microphone access denied. Please allow microphone access in your browser.')
      console.error(err)
    }
  }, [session])

  const stopRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    setIsRecording(false)

    return new Promise((resolve) => {
      recorder.onstop = async () => {
        // Stop all mic tracks
        recorder.stream.getTracks().forEach(t => t.stop())

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType })
        audioChunksRef.current = []

        // Show interim "transcribing…" user bubble
        const interim = {
          id: `opt-voice-${Date.now()}`,
          role: 'user',
          content: '🎙 Transcribing…',
          timestamp: new Date().toISOString(),
          was_transcribed: true,
        }
        appendMessage(interim)
        setLoading(true)

        try {
          const data = await transcribeAudio(session.id, blob)

          // Replace interim bubble with real transcript
          setMessages(prev =>
            prev.map(m => m.id === interim.id
              ? { ...m, content: data.transcript }
              : m
            )
          )
          applyAgentResponse(data)
        } catch (err) {
          setError('Voice transcription failed. Try typing instead.')
          setMessages(prev => prev.filter(m => m.id !== interim.id))
          console.error(err)
        } finally {
          setLoading(false)
        }
        resolve()
      }
      recorder.stop()
    })
  }, [session, appendMessage, applyAgentResponse])

  const requestBrief = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const generatedBrief = await generateBrief(session.id)
      setBrief(generatedBrief)
      setSession(prev => prev ? { ...prev, is_complete: true } : prev)
    } catch (err) {
      setError('Brief generation failed. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [session])

  return {
    session,
    messages,
    brief,
    collectedData,
    loading,
    error,
    isRecording,
    startSession,
    send,
    startRecording,
    stopRecording,
    requestBrief,
    clearError,
  }
}