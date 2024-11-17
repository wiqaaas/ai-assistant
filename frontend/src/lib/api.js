import axios from 'axios'

const API_URL = 'http://localhost:5000/api'

export const processVideo = async (url) => {
  const response = await axios.post(`${API_URL}/process-video`, { url })
  return response.data
}

export const processLocalVideo = async (videoFile) => {
  const formData = new FormData()
  formData.append('video', videoFile)
  const response = await axios.post(`${API_URL}/process-local-video`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const askQuestion = async (question, summary, currentScreenshot, messages) => {
  const response = await axios.post(`${API_URL}/ask-question`, { 
    question, 
    summary,
    currentScreenshot,
    messages
  })
  return response.data
}

export const evaluateAnswer = async (question, answer, context) => {
  const response = await axios.post(`${API_URL}/evaluate-answer`, {
    question,
    answer,
    context
  })
  return response.data
} 