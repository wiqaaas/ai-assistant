import { useState, useRef } from 'react'
import { Input } from './components/ui/input'
import { Button } from './components/ui/button'
import { Textarea } from './components/ui/textarea'
import { Card, CardContent } from './components/ui/card'
import { cn } from './lib/utils'
import { processVideo, askQuestion, processLocalVideo } from './lib/api'
import YouTube from 'react-youtube'
import { Send, Upload } from 'lucide-react'
import wcdLogo from './assets/logo.png'
import html2canvas from 'html2canvas'
import { QuizModal } from './components/QuizModal'


function App() {
  const [videoUrl, setVideoUrl] = useState('')
  const [summary, setSummary] = useState('')
  const [question, setQuestion] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isAsking, setIsAsking] = useState(false)
  const [error, setError] = useState('')
  const [transcript, setTranscript] = useState('')
  const [videoId, setVideoId] = useState('')
  const [messages, setMessages] = useState([])
  const [currentScreenshot, setCurrentScreenshot] = useState(null)
  const [defaultScreenshot, setDefaultScreenshot] = useState(null)
  const [localVideo, setLocalVideo] = useState(null)
  const [isLocalVideo, setIsLocalVideo] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState([])
  const [currentQuiz, setCurrentQuiz] = useState(null)
  const [completedQuizzes, setCompletedQuizzes] = useState(new Set())
  const videoRef = useRef(null)

  const markerStyles = `
    .video-with-markers::-webkit-media-controls-timeline {
      background: linear-gradient(to right,
        ${quizQuestions.map(quiz => `
          transparent calc(${quiz.timestamp}% - 2px),
          ${completedQuizzes.has(quiz.timestamp) ? '#22c55e' : '#eab308'} calc(${quiz.timestamp}% - 2px),
          ${completedQuizzes.has(quiz.timestamp) ? '#22c55e' : '#eab308'} calc(${quiz.timestamp}% + 2px),
          transparent calc(${quiz.timestamp}% + 2px)
        `).join(',')}) !important;
      background-size: 100% 3px !important;
      background-repeat: no-repeat !important;
      background-position: center 0 !important;
    }
  `

  const validateUrl = (url) => {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/
    return regex.test(url)
  }

  const handleUrlSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!validateUrl(videoUrl)) {
      setError('Please enter a valid YouTube URL')
      return
    }
    
    const id = videoUrl.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^&?]+)/)?.[1]
    if (!id) {
      setError('Could not extract video ID from URL')
      return
    }
    setVideoId(id)
    
    setIsAnalyzing(true)
    try {
      const data = await processVideo(videoUrl)
      setSummary(data.summary)
      setTranscript(data.transcript)
    } catch (error) {
      console.error(error)
      setError('Failed to process video. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleLocalVideoSubmit = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    const videoUrl = URL.createObjectURL(file)
    setLocalVideo(videoUrl)
    setIsLocalVideo(true)
    setIsAnalyzing(true)
    
    // Create default screenshot
    const videoElement = document.createElement('video')
    videoElement.src = videoUrl
    videoElement.onloadeddata = async () => {
      videoElement.currentTime = 0
      await new Promise(resolve => setTimeout(resolve, 1000))
      const canvas = document.createElement('canvas')
      canvas.width = videoElement.videoWidth
      canvas.height = videoElement.videoHeight
      canvas.getContext('2d').drawImage(videoElement, 0, 0)
      const screenshot = canvas.toDataURL('image/jpeg').split(',')[1]
      setCurrentScreenshot(screenshot)
      setDefaultScreenshot(screenshot)
      console.log('Default screenshot created:', screenshot.substring(0, 100) + '...')
      console.log('Default screenshot preview URL:', `data:image/jpeg;base64,${screenshot}`)
    }
    
    try {
      const data = await processLocalVideo(file)
      setSummary(data.summary)
      setTranscript(data.transcript)
      setQuizQuestions(data.quizQuestions)
      console.log('Quiz questions with timestamps:', data.quizQuestions)
    } catch (error) {
      console.error(error)
      setError('Failed to process local video. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // function to take screenshot of the video
  const handlePause = async () => {
    try {
      // Target the container div instead of the iframe
      const playerContainer = document.querySelector('.youtube-container');  // Add this class to your container
      if (!playerContainer) return;
      
      const canvas = await html2canvas(playerContainer);
      const screenshot = canvas.toDataURL('image/jpeg').split(',')[1];
      setCurrentScreenshot(screenshot);
      
      console.log('Screenshot captured:', screenshot.substring(0, 100) + '...');
      console.log('Preview URL:', `data:image/jpeg;base64,${screenshot}`);
    } catch (error) {
      console.error('Screenshot error:', error);
    }
  }
  const handleQuestionSubmit = async () => {
    if (!question.trim()) return
    
    const currentQuestion = question
 
    
    setIsAsking(true)
    try {
      const screenshotToUse = currentScreenshot || defaultScreenshot
      console.log('Using screenshot:', screenshotToUse ? 'Current' : 'Default')
      console.log('Screenshot preview URL:', `data:image/jpeg;base64,${screenshotToUse}`)
      const response = await askQuestion(currentQuestion, summary, screenshotToUse, messages)
      console.log('API Response:', response)
      
      if (response && response.answer) {
        setMessages(prev => [...prev, { type: 'question', content: currentQuestion }])
        setQuestion('')
        setError('')
        setMessages(prev => [...prev, { type: 'answer', content: response.answer }])
      } else if (response && response.error) {
        setMessages(prev => [...prev, { type: 'answer', content: `Error: ${response.error}` }])
      }
    } catch (error) {
      console.error('Error details:', error.response?.data || error)
      const errorMessage = error.response?.data?.error || 'Failed to process question. Please try again.'
      setMessages(prev => [...prev, { type: 'answer', content: `Error: ${errorMessage}` }])
      setError(errorMessage)
    } finally {
      setIsAsking(false)
    }
  }

  const handleTimeUpdate = (e) => {
    const video = e.target
    const progress = (video.currentTime / video.duration) * 100
    
    const nextQuiz = quizQuestions.find(q => 
      Math.abs(q.timestamp - progress) < 1 && 
      q !== currentQuiz && 
      !completedQuizzes.has(q.timestamp)
    )
    
    if (nextQuiz) {
      console.log(`Triggering quiz at ${progress.toFixed(2)}% (${video.currentTime.toFixed(2)} seconds)`)
      video.pause()
      setCurrentQuiz(nextQuiz)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fb] overflow-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-white/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container flex h-14 items-center gap-4">
          <div className="flex flex-col items-center justify-center -space-y-1">
            <img src={wcdLogo} alt="WeCloudData Logo" className="h-6 w-auto" />
            <span className="text-[10px] font-medium text-primary">WeCloudData</span>
          </div>
          <h1 className="text-lg font-semibold text-primary ml-2">AI Tutorial Assistant</h1>
        </div>
      </nav>

      <div className="fixed top-14 left-0 right-80 bottom-0 overflow-auto">
        <div className="container py-8">
          <Card className="p-4 bg-white/80 shadow-lg border-muted/50 backdrop-blur-sm">
            <form onSubmit={handleUrlSubmit} className="flex flex-col gap-4">
              <div className="flex gap-4">
                <Input
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste YouTube URL here"
                  className={cn(
                    "flex-1 bg-white border-muted/60 shadow-sm",
                    error && "border-destructive"
                  )}
                />
                <Button 
                  type="submit" 
                  disabled={isAnalyzing}
                  className="bg-primary hover:bg-primary/90 text-white shadow-md"
                >
                  {isAnalyzing ? "Analyzing..." : "Analyze Video"}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Or</span>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                  <Upload className="h-4 w-4" />
                  Upload Video
                  <Input
                    type="file"
                    accept="video/*"
                    onChange={handleLocalVideoSubmit}
                    disabled={isAnalyzing}
                    className="hidden"
                  />
                </label>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </form>
          </Card>

          <Card className="mt-8">
            <CardContent className="p-0 youtube-container relative" style={{ height: '400px' }}>
              {isLocalVideo ? (
                <div className="relative h-full group">
                  <video
                    ref={videoRef}
                    src={localVideo}
                    controls
                    className={cn("w-full h-full video-with-markers")}
                    onPause={handlePause}
                    onTimeUpdate={handleTimeUpdate}
                    style={{ [`--marker-styles`]: markerStyles }}
                  />
                </div>
              ) : videoId ? (
                <YouTube
                  videoId={videoId}
                  className="w-full h-full"
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: 0,
                      origin: window.location.origin,
                      modestbranding: 1,
                    },
                    host: 'https://www.youtube-nocookie.com'
                  }}
                  onPause={handlePause}
                  onError={(e) => {
                    console.error('YouTube Player Error:', e);
                    setError('Failed to load YouTube player. Please try again.');
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 rounded-lg border-2 border-dashed border-muted">
                  <p className="text-muted-foreground font-medium">Upload a video or paste a YouTube URL</p>
                  <p className="text-muted-foreground/60 text-sm mt-1">The video will appear here</p>
                </div>
              )}
              {currentQuiz && (
                <QuizModal
                  question={currentQuiz.question}
                  context={transcript}
                  onClose={() => setCurrentQuiz(null)}
                  onContinue={() => {
                    const timestamp = currentQuiz.timestamp
                    setCompletedQuizzes(prev => new Set([...prev, timestamp]))
                    setCurrentQuiz(null)
                    const videoElement = document.querySelector('video')
                    if (videoElement) videoElement.play()
                  }}
                />
              )}
            </CardContent>
          </Card>

          <div className="mt-8">
            <div className="bg-muted/50 rounded-lg p-4 border border-muted">
              <h3 className="text-xs font-semibold text-primary mb-2">Video Summary</h3>
              <p className="text-muted-foreground text-[11px] whitespace-pre-wrap">
                {summary || "Video summary will appear here"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Card className="fixed right-0 top-14 bottom-0 w-80 rounded-none border-l bg-white/70 backdrop-blur-md">
        <div className="flex h-full flex-col">
          <CardContent className="flex-1 overflow-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <p className="text-muted-foreground text-sm font-medium">No message yet :( </p>
                <p className="text-muted-foreground/60 text-xs mt-1">
                  Let's get started, ask me anything you want !
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div key={index} className={cn(
                  "flex",
                  message.type === 'question' ? "justify-end" : "justify-start"
                )}>
                  <div className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2",
                    message.type === 'question' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted"
                  )}>
                    <p className="text-[11px] whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
          <div className="border-t bg-muted/30 p-4">
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                handleQuestionSubmit()
              }}
              className="flex gap-2"
            >
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={currentQuiz ? "Please complete the quiz first..." : "Start typing here..."}
                rows={3}
                disabled={isAsking || currentQuiz}
                className="resize-none bg-white/90 shadow-sm flex-1 disabled:opacity-50"
              />
              <Button 
                type="submit" 
                disabled={isAsking || currentQuiz}
                size="sm"
                className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md p-0 self-center disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </Card>

      <style>
        {markerStyles}
      </style>
    </div>
  )
}

export default App
