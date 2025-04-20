import { useState, useRef } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale
} from 'chart.js'

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend, CategoryScale)

function App() {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
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
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)

      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      setLoading(true) 
      fetch('https://speakeasy-53jo.onrender.com/analyze', {
        method: 'POST',
        body: formData,
      })
        .then(async (res) => {
        const text = await res.text()
        try {
          const data = JSON.parse(text)
          console.log("🧪 Parsed JSON:", data)
          setAnalysis(data)
        } catch (err) {
          console.error("❌ Failed to parse JSON:", text)
        }
        })
        .then((data) => {
          console.log('Response from server:', data)
          setAnalysis(data)
        })
        .catch((err) => console.error('Error uploading audio:', err))
        .finally(() => setLoading(false))
    }

    mediaRecorder.start()
    setRecording(true)
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const renderLineChart = (label: string, data: any[], color: string) => {
    const cleaned = data.filter(d => d && typeof d.y === 'number' && !isNaN(d.y))
    return (
      <div style={{ marginBottom: '2rem' }}>
        <h3>{label}</h3>
        <Line
          data={{
            labels: cleaned.map((d) => d.x.toFixed(2)),
            datasets: [
              {
                label: label,
                data: cleaned.map((d) => d.y),
                borderColor: color,
                backgroundColor: color + '33',
                tension: 0.3,
              }
            ]
          }}
          options={{
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }}
        />
      </div>
    )
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>SpeakEasy Voice Analyzer</h1>

      {!recording ? (
        <button onClick={startRecording}>Start Recording</button>
      ) : (
        <button onClick={stopRecording}>Stop Recording</button>
      )}

      {audioUrl && (
        <div style={{ marginTop: '1rem' }}>
          <audio controls src={audioUrl}></audio>
          <br />
          <a href={audioUrl} download="recording.webm">Download Recording</a>
        </div>
      )}
      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Analyzing...</p>}

      {analysis && (
        <div style={{ marginTop: '2rem' }}>
          {renderLineChart('Pitch (Hz)', analysis.pitch, '#2ecc71')}
          {renderLineChart('Formant 1 (F1)', analysis.f1, '#f39c12')}
          {renderLineChart('Formant 2 (F2)', analysis.f2, '#e74c3c')}
          {renderLineChart('Formant 3 (F3)', analysis.f3, '#8e44ad')}
        </div>
      )}
    </main>
  )
}

export default App
