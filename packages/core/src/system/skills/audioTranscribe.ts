import fs from 'fs';
import path from 'path';
import { getOpenAI } from '../../agent/reasoning';

export async function transcribeAudio(filePath: string): Promise<string> {
  try {
    const absolutePath = path.resolve(filePath);
    if (!fs.existsSync(absolutePath)) {
      return `Error: File not found at ${absolutePath}`;
    }

    const openai = await getOpenAI();
    
    // Whisper API Call
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(absolutePath),
      model: 'whisper-1',
    });

    return `Transcription Success:\n${transcription.text}`;
  } catch (error: any) {
    return `Failed to transcribe audio: ${error.message}`;
  }
}

export const audioTranscribeToolDefinition = {
  type: "function",
  function: {
    name: "transcribe_audio",
    description: "Transcribes an audio file (mp3, wav) into text using the Whisper model. Useful for listening to voice commands or reading audio notes.",
    parameters: {
      type: "object",
      properties: {
        filePath: {
          type: "string",
          description: "The absolute or relative path to the audio file.",
        }
      },
      required: ["filePath"],
    },
  },
};
