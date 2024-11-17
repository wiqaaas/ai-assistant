from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
import os
import chromadb

class VectorStore:
    def __init__(self):
        self.embeddings = OpenAIEmbeddings()
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=100,
            length_function=len,
        )
        self.vector_store = None
        
        # Create persistent directory if it doesn't exist
        self.persist_directory = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
        os.makedirs(self.persist_directory, exist_ok=True)

    def create_vector_store(self, transcript):
        try:
            # Split transcript into chunks
            chunks = self.text_splitter.split_text(transcript)
            
            # Create new vector store without persistence
            self.vector_store = Chroma.from_texts(
                texts=chunks,
                embedding=self.embeddings,
                persist_directory=self.persist_directory
            )
            
            return chunks
            
        except Exception as e:
            print(f"Error creating vector store: {str(e)}")
            return []

    def get_relevant_chunks(self, question, k=3):
        if not self.vector_store:
            print("Vector store is not initialized")
            return []
        
        try:
            # Search for similar chunks
            docs = self.vector_store.similarity_search(question, k=k)
            chunks = [doc.page_content for doc in docs]
            print(f"Found {len(chunks)} relevant chunks")
            return chunks
        except Exception as e:
            print(f"Error searching vector store: {str(e)}")
            return [] 