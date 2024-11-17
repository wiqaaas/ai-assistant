from flask import Flask, request, jsonify
from flask_cors import CORS
from pytube import YouTube
from youtube_transcript_api import YouTubeTranscriptApi
import re
from openai import OpenAI
import os
from dotenv import load_dotenv
from utils.vector_store import VectorStore
from typing import List, Dict

app = Flask(__name__)
CORS(app)

load_dotenv()  # Load environment variables from .env file
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
vector_store = VectorStore()  # Add this line to create the instance

def get_video_id(url):
    video_id = None
    if 'youtu.be' in url:
        video_id = url.split('/')[-1]
    elif 'youtube.com' in url:
        video_id = re.search(r'v=([^&]+)', url).group(1)
    return video_id

@app.route('/api/process-video', methods=['POST'])
def process_video():
    try:
        data = request.json
        video_url = data.get('url')
        
        if not video_url:
            return jsonify({'error': 'No URL provided'}), 400

        video_id = get_video_id(video_url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400

        # Get YouTube transcript
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        transcript_text = ' '.join([item['text'] for item in transcript_list])
        
        # Generate summary using GPT
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes video transcripts."},
                {"role": "user", "content": f"Please provide a concise summary of this video transcript: {transcript_text}"}
            ]
        )
        
        summary = response.choices[0].message.content
        # After getting transcript, create vector store
        vector_store.create_vector_store(transcript_text)
        
        return jsonify({
            'transcript': transcript_text,
            'summary': summary
        })
        
    except Exception as e:
        print(f"Error: {str(e)}")  # For debugging
        return jsonify({'error': str(e)}), 500

@app.route('/api/ask-question', methods=['POST'])
def ask_question():
    try:
        data = request.json
        question = data.get('question')
        summary = data.get('summary')
        currentScreenshot = data.get('currentScreenshot')
        messages = data.get('messages')

        if not question or not summary:
            return jsonify({'error': 'Question or transcript missing'}), 400
        
        if not currentScreenshot:
            return jsonify({'error': 'No screenshot available. Please pause the video first.'}), 400
            
        # Get relevant chunks from vector store
        try:
            relevant_chunks = vector_store.get_relevant_chunks(question)
            if not relevant_chunks:
                return jsonify({'error': 'No relevant context found. Please try a different question.'}), 400
        except Exception as e:
            print(f"Vector store error: {str(e)}")
            return jsonify({'error': 'Failed to retrieve context from video'}), 500

        # Create context from summary and relevant chunks
        context = f"""
        Video Summary: {summary}
        previous messages: {messages}
        Relevant Transcript Sections:
        {' '.join(relevant_chunks)}
        """

        try:
            # Make API call to GPT
            response = client.chat.completions.create(
                model="gpt-4-vision-preview",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that answers questions about video content based on summary and visual context."},
                    {"role": "user", "content": [
                        {"type": "text", "text": f"Based on this context and the video frame, please answer: {question}\n\nContext:\n{context}"},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{currentScreenshot}"}}
                    ]}
                ],
                temperature=0.7
            )
            
            answer = response.choices[0].message.content.strip()
            return jsonify({'answer': answer})
            
        except Exception as e:
            print(f"OpenAI API Error: {str(e)}")
            return jsonify({'error': 'Failed to generate answer from AI'}), 500

    except Exception as e:
        print(f"General Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/process-local-video', methods=['POST'])
def process_local_video():
    try:
        # Load transcript from transcript.txt
        with open("transcript.txt", "r") as file:
            transcript_text = file.read()        
        print("Transcript successfully loaded from transcript.txt")

        # Process transcript to get summary and quiz questions
        print("Processing transcript...")
        processed_data = process_transcript(transcript_text)
        if not processed_data:
            return jsonify({'error': 'Failed to process transcript'}), 500
        print("Processed data:", processed_data)
            
        # Create vector store
        print("Creating vector store...")
        vector_store.create_vector_store(transcript_text)
        print("Vector store created")
            
        return jsonify({
            'transcript': transcript_text,
            **processed_data  # This will include both summary and quizQuestions
        })

    except Exception as e:
        print(f"Error processing transcript file: {str(e)}")  # For debugging
        return jsonify({'error': str(e)}), 500

@app.route('/api/evaluate-answer', methods=['POST'])
def evaluate_answer():
    try:
        data = request.json
        question = data.get('question')
        answer = data.get('answer')
        context = data.get('context')
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an educator evaluating student responses. Provide constructive feedback."},
                {"role": "user", "content": f"Question: {question}\nStudent's Answer: {answer}\nContext: {context}\n\nEvaluate this answer and provide feedback."}
            ]
        )
        
        feedback = response.choices[0].message.content
        return jsonify({'feedback': feedback})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def process_transcript(transcript: str):
    try:
        print("Generating summary and quiz questions...")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an AI assistant that analyzes video transcripts. Generate both a concise summary and 3 quiz questions. For quiz questions, include timestamps (as percentage between 0-100) when they should be asked. Format your response as a JSON object with 'summary' and 'quizQuestions' fields. The quizQuestions should be an array of objects, each containing 'question' and 'timestamp'."},
                {"role": "user", "content": f"Process this transcript and generate summary and quiz questions with timestamps (as percentage between 0-100): {transcript}"}
            ],
            response_format={ "type": "json_object" }
        )
        result = response.choices[0].message.content
        print("GPT response:", result)
        
        # Parse JSON response
        import json
        parsed_data = json.loads(result)
        print("Parsed data:", parsed_data)
        return parsed_data
    except Exception as e:
        print(f"Transcript processing error: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return None

if __name__ == '__main__':
    app.run(debug=True, port=5000) 