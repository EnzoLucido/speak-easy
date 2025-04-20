import { useState, useRef, useEffect } from 'react'
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
import annotationPlugin from 'chartjs-plugin-annotation'

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  annotationPlugin
);

// ✅ Enable annotation globally for Chart.js 4
ChartJS.defaults.plugins.annotation = {
  ...ChartJS.defaults.plugins.annotation,
  clip: false,
};


function App() {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  // Track audio playback time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
  
    let rafId: number;
  
    const update = () => {
      setCurrentTime(audio.currentTime);
      rafId = requestAnimationFrame(update);
    };
  
    const handlePlay = () => {
      rafId = requestAnimationFrame(update);
    };
  
    const handlePause = () => {
      cancelAnimationFrame(rafId);
    };
  
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handlePause);
  
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handlePause);
      cancelAnimationFrame(rafId);
    };
  }, []);
  
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
      setCurrentTime(0)

      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')
      setLoading(true)

      fetch('https://speakeasy-53jo.onrender.com/analyze', {
        method: 'POST',
        body: formData
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

  const renderLineChart = (
    label: string,
    data: any[],
    color: string,
    currentTime: number
  ) => {
    // Set sensible limits per graph type
    const yLimits: Record<string, [number, number]> = {
      "Pitch (Hz)": [60, 400],
      "Formant 1 (F1)": [200, 1000],
      "Formant 2 (F2)": [600, 3000],
      "Formant 3 (F3)": [1800, 4000]
    }
  
    const [yMin, yMax] = yLimits[label] || [0, 5000] // fallback range
  
    // Clean + filter data within limits
    const cleaned = data.filter(
      (d) =>
        d &&
        typeof d.y === 'number' &&
        !isNaN(d.y) &&
        d.y >= yMin &&
        d.y <= yMax
    )
  
    return (
      <div className="chart-container" style={{ marginBottom: '2rem' }}>
        <h3>{label}</h3>
        <Line
          data={{
            datasets: [
              {
                label,
                data: cleaned.map((d) => ({ x: d.x, y: d.y })),
                borderColor: color,
                backgroundColor: color + '33',
                tension: 0.3,
                pointRadius: 0,
                borderWidth: 2
              }
            ]
          }}
          options={{
            responsive: true,
            animation: false,
            scales: {
              x: {
                type: 'linear',
                min: 0, // always start from 0 seconds
                title: {
                  display: true,
                  text: 'Time (s)'
                }
              },
              y: {
                min: yMin,
                max: yMax,
                title: {
                  display: true,
                  text: 'Frequency (Hz)'
                }
              }
            },
            plugins: {
              legend: { display: false },
              annotation: {
                clip: false, // ← ADD THIS HERE!
                annotations: {
                  nowLine: {
                    type: 'line',
                    xMin: currentTime,
                    xMax: currentTime,
                    borderColor: '#e74c3c',
                    borderWidth: 2,
                    label: {
                      content: 'Now',
                      display: true,
                      position: 'start',
                      backgroundColor: 'transparent',
                      color: '#e74c3c',
                      font: {
                        weight: 'bold'
                      }
                    }
                  }
                }
              }
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
          <audio ref={audioRef} controls src={audioUrl}></audio>
          <br />
          <a href={audioUrl} download="recording.webm">Download Recording</a>
        </div>
      )}

      {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Analyzing...</p>}

      {analysis && (
        <div style={{ marginTop: '2rem' }}>
          {analysis?.pitch && renderLineChart('Pitch (Hz)', analysis.pitch, '#2ecc71', currentTime)}
          {analysis?.f1 && renderLineChart('Formant 1 (F1)', analysis.f1, '#f39c12', currentTime)}
          {analysis?.f2 && renderLineChart('Formant 2 (F2)', analysis.f2, '#e74c3c', currentTime)}
          {analysis?.f3 && renderLineChart('Formant 3 (F3)', analysis.f3, '#8e44ad', currentTime)}
        </div>
      )}

    </main>
  )
}

export default App
