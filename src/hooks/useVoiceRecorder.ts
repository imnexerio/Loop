/**
 * Voice Recorder Hook with Real-Time Transcription + Audio Capture
 * Uses Web Speech API for speech-to-text
 * Uses MediaRecorder API for audio capture
 * Compatible with Chrome, Edge, Safari (desktop)
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { getSupportedMimeType } from '../services/audioService'

interface UseVoiceRecorderOptions {
  onTranscript?: (text: string, isFinal: boolean) => void
  language?: string
  continuous?: boolean
}

interface UseVoiceRecorderReturn {
  isRecording: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  error: string | null
  audioBlob: Blob | null
  audioDuration: number
  startRecording: () => void
  stopRecording: () => Promise<{ blob: Blob | null; duration: number }>
  clearTranscript: () => void
  clearAudio: () => void
}

// Check for Speech Recognition support
const SpeechRecognition = 
  (window as any).SpeechRecognition || 
  (window as any).webkitSpeechRecognition

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}): UseVoiceRecorderReturn {
  const { 
    onTranscript, 
    language = 'en-US',
    continuous = true 
  } = options

  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioDuration, setAudioDuration] = useState(0)
  
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const startTimeRef = useRef<number>(0)
  const streamRef = useRef<MediaStream | null>(null)
  const stopResolveRef = useRef<((result: { blob: Blob | null; duration: number }) => void) | null>(null)
  
  const isSupported = !!SpeechRecognition && !!window.MediaRecorder

  // Initialize speech recognition
  const initRecognition = useCallback(() => {
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser. Try Chrome or Edge.')
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = language
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      console.log('[VoiceRecorder] Speech recognition started')
    }

    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalText += text
        } else {
          interimText += text
        }
      }

      if (finalText) {
        setTranscript(prev => {
          const newText = prev ? prev + ' ' + finalText : finalText
          return newText
        })
        // Send only the NEW final text, not the cumulative transcript
        onTranscript?.(finalText, true)
        setInterimTranscript('')
      } else {
        setInterimTranscript(interimText)
        onTranscript?.(interimText, false)
      }
    }

    recognition.onerror = (event: any) => {
      console.error('[VoiceRecorder] Speech error:', event.error)
      
      // Don't set error for no-speech - that's normal
      if (event.error === 'no-speech') {
        return
      }
      
      switch (event.error) {
        case 'audio-capture':
          setError('No microphone found. Please check your device.')
          break
        case 'not-allowed':
          setError('Microphone permission denied. Please allow access.')
          break
        case 'network':
          setError('Network error. Speech recognition requires internet.')
          break
        default:
          setError(`Error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      console.log('[VoiceRecorder] Speech recognition ended')
      setInterimTranscript('')
    }

    return recognition
  }, [continuous, language, onTranscript])

  // Initialize media recorder for audio capture
  const initMediaRecorder = useCallback((stream: MediaStream) => {
    const mimeType = getSupportedMimeType()
    const options: MediaRecorderOptions = {
      audioBitsPerSecond: 64000 // 64 kbps for good voice quality, small size
    }
    
    if (mimeType) {
      options.mimeType = mimeType
    }
    
    const mediaRecorder = new MediaRecorder(stream, options)
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data)
      }
    }
    
    mediaRecorder.onstop = () => {
      const duration = (Date.now() - startTimeRef.current) / 1000
      setAudioDuration(duration)
      
      let blob: Blob | null = null
      if (audioChunksRef.current.length > 0) {
        blob = new Blob(audioChunksRef.current, { 
          type: mimeType || 'audio/webm' 
        })
        setAudioBlob(blob)
        console.log(`[VoiceRecorder] Audio captured: ${(blob.size / 1024).toFixed(1)} KB, ${duration.toFixed(1)}s`)
      }
      
      // Resolve the stop promise if waiting
      if (stopResolveRef.current) {
        stopResolveRef.current({ blob, duration })
        stopResolveRef.current = null
      }
    }
    
    return mediaRecorder
  }, [])

  // Start recording (both transcription and audio)
  const startRecording = useCallback(async () => {
    setError(null)
    audioChunksRef.current = []
    setAudioBlob(null)
    setAudioDuration(0)
    
    // Request microphone permission and get stream
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      })
      streamRef.current = stream
      
      // Initialize and start media recorder
      mediaRecorderRef.current = initMediaRecorder(stream)
      mediaRecorderRef.current.start(1000) // Collect data every second
      startTimeRef.current = Date.now()
      
      // Initialize and start speech recognition
      if (!recognitionRef.current) {
        recognitionRef.current = initRecognition()
      }
      
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch (err) {
          // Already started, restart
          recognitionRef.current.stop()
          setTimeout(() => {
            recognitionRef.current?.start()
          }, 100)
        }
      }
      
      setIsRecording(true)
      console.log('[VoiceRecorder] Recording started (audio + transcription)')
      
    } catch (err) {
      console.error('[VoiceRecorder] Failed to start:', err)
      setError('Microphone permission denied. Please allow access in browser settings.')
    }
  }, [initRecognition, initMediaRecorder])

  // Stop recording - returns a promise that resolves with the audio blob
  const stopRecording = useCallback((): Promise<{ blob: Blob | null; duration: number }> => {
    return new Promise((resolve) => {
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      
      // If media recorder is active, wait for onstop to resolve
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        stopResolveRef.current = resolve
        mediaRecorderRef.current.stop()
      } else {
        // No recording active, resolve immediately
        resolve({ blob: null, duration: 0 })
      }
      
      // Stop all tracks in the stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      setIsRecording(false)
      console.log('[VoiceRecorder] Recording stopped')
    })
  }, [])

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  // Clear audio
  const clearAudio = useCallback(() => {
    setAudioBlob(null)
    setAudioDuration(0)
    audioChunksRef.current = []
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return {
    isRecording,
    isSupported,
    transcript,
    interimTranscript,
    error,
    audioBlob,
    audioDuration,
    startRecording,
    stopRecording,
    clearTranscript,
    clearAudio
  }
}
