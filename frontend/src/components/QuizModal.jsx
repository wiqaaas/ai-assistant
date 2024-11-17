import { useState } from 'react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { evaluateAnswer } from '../lib/api'
import { SkipForward } from 'lucide-react'

export function QuizModal({ question, context, onClose, onContinue }) {
  const [answer, setAnswer] = useState('')
  const [feedback, setFeedback] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEvaluated, setIsEvaluated] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      const { feedback } = await evaluateAnswer(question, answer, context)
      setFeedback(feedback)
      setIsEvaluated(true)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center">
      <Card className="w-full h-full max-w-full max-h-full rounded-none bg-white/80 relative">
        <Button 
          onClick={onContinue}
          variant="outline"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/40 hover:bg-white/60 text-foreground/60 hover:text-foreground p-0"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        <CardContent className="p-6 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4">
            <h3 className="text-lg font-semibold text-primary">Quiz Question</h3>
            <p className="text-base text-foreground font-medium">{question}</p>
            
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              rows={4}
              disabled={isEvaluated}
              className="resize-none bg-white/90"
            />
            
            {feedback && (
              <div className="bg-white/70 p-3 rounded-lg border border-muted">
                <p className="text-sm text-foreground whitespace-pre-wrap">{feedback}</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            {!isEvaluated ? (
              <Button 
                onClick={handleSubmit} 
                disabled={!answer.trim() || isSubmitting}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </Button>
            ) : (
              <Button 
                onClick={onContinue}
                className="bg-primary text-white hover:bg-primary/90"
              >
                Continue Video
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 