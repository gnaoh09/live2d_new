import os
import asyncio
from loguru import logger
from google import genai
from google.genai import types
import wave
import uuid
from .tts_interface import TTSInterface


class TTSEngine(TTSInterface):
    def __init__(self, api_key: str, voice: str = "Kore", chunk_size: int = 200):
        super().__init__()
        self.api_key = api_key
        if not self.api_key:
            logger.error("API key not provided.")
            raise ValueError("API key not provided.")
        
        self.client = genai.Client(api_key=self.api_key)
        # Using the model name specified in the provided code snippet for TTS
        self.model_name = "gemini-2.5-flash-preview-tts"
        self.voice = voice
        self.chunk_size = chunk_size  # Maximum characters per chunk

    def _chunk_text(self, text: str) -> list[str]:
        """Split text into chunks of approximately equal size."""
        # Split by sentences first to avoid cutting mid-sentence
        sentences = text.replace('!', '.').replace('?', '.').split('.')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip() + '.'
            if len(current_chunk) + len(sentence) <= self.chunk_size:
                current_chunk += sentence
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                current_chunk = sentence
        
        if current_chunk:
            chunks.append(current_chunk)
            
        return chunks

    async def _generate_chunk_audio(self, text: str) -> str:
        """Generate audio for a single text chunk."""
        temp_file = self.generate_cache_file_name(str(uuid.uuid4()))
        
        try:
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=self.voice
                            )
                        )
                    )
                )
            )
            
            audio_data = response.candidates[0].content.parts[0].inline_data.data

            with wave.open(temp_file, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                wf.writeframes(audio_data)
            
            return temp_file

        except Exception as e:
            logger.error(f"Error generating audio for chunk: {e}")
            return ""

    async def async_generate_audio(self, text: str, file_name_no_ext=None) -> str:
        """Asynchronously generate speech audio file using Gemini TTS with chunking."""
        final_audio_file = self.generate_cache_file_name(file_name_no_ext)
        
        # Split text into chunks
        chunks = self._chunk_text(text)
        if not chunks:
            logger.error("No text chunks to process")
            return ""

        # Generate audio for each chunk concurrently
        chunk_files = await asyncio.gather(
            *[self._generate_chunk_audio(chunk) for chunk in chunks]
        )
        
        # Filter out any failed generations
        chunk_files = [f for f in chunk_files if f]
        
        if not chunk_files:
            logger.error("Failed to generate any audio chunks")
            return ""

        # Combine all audio files
        try:
            with wave.open(final_audio_file, 'wb') as outfile:
                # Get parameters from first file
                with wave.open(chunk_files[0], 'rb') as first_file:
                    outfile.setnchannels(first_file.getnchannels())
                    outfile.setsampwidth(first_file.getsampwidth())
                    outfile.setframerate(first_file.getframerate())
                    outfile.writeframes(first_file.readframes(first_file.getnframes()))

                # Append remaining files
                for chunk_file in chunk_files[1:]:
                    with wave.open(chunk_file, 'rb') as infile:
                        outfile.writeframes(infile.readframes(infile.getnframes()))

            # Clean up temporary files
            for chunk_file in chunk_files:
                self.remove_file(chunk_file, verbose=False)

            logger.info(f"Generated audio file: {final_audio_file}")
            return final_audio_file

        except Exception as e:
            logger.error(f"Error combining audio files: {e}")
            # Clean up temporary files
            for chunk_file in chunk_files:
                self.remove_file(chunk_file, verbose=False)
            return ""

    def generate_audio(self, text: str, file_name_no_ext=None) -> str:
        """Synchronous wrapper for async_generate_audio."""
        return asyncio.run(self.async_generate_audio(text, file_name_no_ext))

