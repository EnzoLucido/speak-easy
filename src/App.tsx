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
import './App.css'


ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  annotationPlugin
)

ChartJS.defaults.plugins.annotation = {
  ...ChartJS.defaults.plugins.annotation,
  clip: false,
}

// ✅ Mask based on pitch activity + frequency range
function applyVoiceMaskToData(
  data: { x: number, y: number }[],
  pitchRef: { x: number, y: number }[],
  freqRange: [number, number]
) {
  const [minFreq, maxFreq] = freqRange
  const maxJump = 400
  const maxTimeGap = 0.25

  const output: { x: number, y: number | null }[] = []

  for (let i = 0; i < data.length; i++) {
    const point = data[i]
    if (!point || typeof point.x !== 'number') continue

    const pitchAtTime = pitchRef.find(p => Math.abs(p.x - point.x) < 0.01)

    const isVoiced =
      pitchAtTime &&
      pitchAtTime.y >= 60 &&
      pitchAtTime.y <= 400

    const isValidFreq =
      typeof point.y === 'number' &&
      !isNaN(point.y) &&
      point.y >= minFreq &&
      point.y <= maxFreq

    const prev = output.length ? output[output.length - 1] : null
    const timeGap = prev ? point.x - prev.x : 0
    const freqJump = prev && prev.y !== null ? Math.abs(point.y - prev.y) : 0

    const shouldBreak = !isVoiced || !isValidFreq || freqJump > maxJump || timeGap > maxTimeGap

    output.push({ x: point.x, y: shouldBreak ? null : point.y })
  }

  return output
}

function App() {
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)

  


  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  // Track audio playback time
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return
    const audio = audioRef.current
    console.log("🎧 Audio is ready. Adding listeners.")

    let rafId: number

    const update = () => {
      if (!audio.paused) {
        setCurrentTime(audio.currentTime)
        rafId = requestAnimationFrame(update)
      }
    }

    const handlePlay = () => {
      rafId = requestAnimationFrame(update)
      setIsPlaying(true) // ✅ set to playing
    }
    
    const handlePause = () => {
      cancelAnimationFrame(rafId)
      setIsPlaying(false) // ✅ always reset when paused or ended
    }
    audio.addEventListener('ended', () => {
      handlePause()
      setCurrentTime(0)
    })
    

    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handlePause)

    return () => {
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handlePause)
      cancelAnimationFrame(rafId)
    }
  }, [audioUrl])

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
            setAnalysis(data)

            const allTimestamps = [
              ...(data.pitch || []).map((d: any) => d.x),
              ...(data.f1 || []).map((d: any) => d.x),
              ...(data.f2 || []).map((d: any) => d.x),
              ...(data.f3 || []).map((d: any) => d.x)
            ].filter((x: any) => typeof x === 'number')
            
            const globalMinX = Math.min(...allTimestamps)
            const inferred = Math.max(...allTimestamps)
            
            console.log("📏 Normalized base x =", globalMinX)
            console.log("⏱️ Inferred duration from data:", inferred)
            
            setDuration(inferred)
            setAnalysis({
              ...data,
              _minX: globalMinX // attach to analysis for reuse
            })
            
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
    rawData: { x: number, y: number }[],
    color: string,
    currentTime: number,
    duration: number | null
  ) => {
    const ranges: Record<string, [number, number]> = {
      "Pitch (Hz)": [60, 450],
      "Formant 1 (F1)": [200, 1000],
      "Formant 2 (F2)": [600, 3000],
      "Formant 3 (F3)": [1800, 4000]
    }
  
    const range = ranges[label] || [0, 5000]
  
    // Normalize X values
    const minX = analysis?._minX || 0

  
    const normalizedData = rawData.map((d) => ({
      x: d.x - minX,
      y: d.y
    }))
  
    const normalizedPitch = (analysis?.pitch || []).map((d: { x: number, y: number }) => ({
      x: d.x - minX,
      y: d.y
    }))
  
    const masked = applyVoiceMaskToData(normalizedData, normalizedPitch, range)
  
    // Pad to full audio duration
    if (duration && duration > 0) {
      masked.push({ x: duration, y: null })
    }
  
    console.log(
      `[${label}] Chart range: 0 - ${duration}, data max:`,
      Math.max(...masked.map((m) => (typeof m.x === 'number' ? m.x : 0)))
    )
  
    return (
      <div className="chart-container" style={{ marginBottom: '2rem' }}>
        <h3>{label}</h3>
        <Line
          data={{
            datasets: [
              {
                label,
                data: masked,
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
                min: 0,
                max: duration || undefined,
                title: {
                  display: true,
                  text: 'Time (s)'
                }
              },
              y: {
                min: range[0],
                max: range[1],
                title: {
                  display: true,
                  text: 'Frequency (Hz)'
                }
              }
            },
            plugins: {
              legend: { display: false },
              annotation: {
                clip: false,
                annotations: {
                  nowLine: {
                    type: 'line',
                    scaleID: 'x',
                    value: currentTime,
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
    <div style={{ position: 'relative' }}>
       <a href="/guide" className="guide-button">
       How to Use SpeakEasy
      </a>
      <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1>SpeakEasy Voice Analyzer</h1>
  
        {!recording ? (
          <button onClick={startRecording}>Start Recording</button>
              ) : (
            <button onClick={stopRecording} className="stop-button">Stop Recording</button>
          )}

  
        {audioUrl && (
          <div style={{ marginTop: '1rem' }}>
                                   <audio
                ref={audioRef}
                controls
                src={audioUrl}
                onLoadedMetadata={() => {
                  const audio = audioRef.current
                  if (audio && isFinite(audio.duration)) {
                    console.log('✅ Safe duration loaded:', audio.duration)
                    setDuration(audio.duration)
                  } else {
                    console.warn('⏳ Duration not ready yet. Trying again...')

                    // Try again after a small delay
                    setTimeout(() => {
                      if (audio && isFinite(audio.duration)) {
                        console.log('✅ Duration loaded after retry:', audio.duration)
                        setDuration(audio.duration)
                      } else {
                        console.error('❌ Still no valid duration. Giving up.')
                      }
                    }, 500)
                  }
                }}
              />


            <br />
            <a href={audioUrl} download="recording.webm">Download Recording</a>
          </div>
        )}
  
        {analysis?.voice && (
          <div className="analysis-stats" style={{ marginTop: '1rem' }}>
            <p><strong>Mean Pitch:</strong> {analysis.voice.meanF0?.toFixed(2)} Hz</p>
            <p><strong>Pitch Standard Deviation:</strong> {analysis.voice.stdevF0?.toFixed(2)} Hz</p>
            <p><strong>Harmonics-to-Noise Ratio:</strong> {analysis.voice.hnr?.toFixed(2)} dB</p>
          </div>
        )}
  
        {loading && <p style={{ color: '#888', fontStyle: 'italic' }}>Analyzing...</p>}
  
        {analysis && (
          <div style={{ marginTop: '2rem' }}>
          {analysis?.pitch && renderLineChart('Pitch (F0)', analysis.pitch, '#2ecc71', currentTime, duration)}
          {analysis?.f1 && renderLineChart('Formant 1 (F1)', analysis.f1, '#f39c12', currentTime, duration)}
          {analysis?.f2 && renderLineChart('Formant 2 (F2)', analysis.f2, '#e74c3c', currentTime, duration)}
          {analysis?.f3 && renderLineChart('Formant 3 (F3)', analysis.f3, '#8e44ad', currentTime, duration)}
          
          </div>
        )}
      </main>
  
      {/* ✅ Floating Play Button (visible only after analysis is ready) */}
      {audioUrl && analysis && (
        <button
        onClick={() => {
          const audio = audioRef.current
          if (audio) {
            if (audio.paused) {
              audio.play()
              setIsPlaying(true)
            } else {
              audio.pause()
              setIsPlaying(false)
            }
          }
        }}
          className="side-play-button"
          aria-label="Play or Pause"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
      )}
    </div>
  )
}  
export default App
