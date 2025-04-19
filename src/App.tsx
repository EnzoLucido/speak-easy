import { useState, useRef } from 'react'

function App() {
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        const url = URL.createObjectURL(blob)
        const formData = new FormData()
        formData.append('audio', blob, 'recording.wav')
        fetch('https://speakeasy-53jo.onrender.com/', {
          method: 'POST',
          body: formData,
        })
        .then((res) => res.text())
        .then((text) => console.log(text))
        .catch((err) => console.error('Error uploading audio:', err))
        setAudioUrl(url)
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (err) {
      console.error('Error accessing microphone:', err)
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Audio Recorder</h1>

      {!recording ? (
        <button onClick={startRecording}>Start Recording</button>
      ) : (
        <button onClick={stopRecording}>Stop Recording</button>
      )}

      {audioUrl && (
        <div style={{ marginTop: '1rem' }}>
          <audio controls src={audioUrl}></audio>
          <br />
          <a href={audioUrl} download="recording.wav">Download Recording</a>
        </div>
      )}
    </main>
  )
}

export default App
