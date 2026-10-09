import "server-only";

import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";
import { getBrand } from "@/lib/agent/brand";
import { buildSystemInstruction } from "@/lib/agent/prompt";
import { toolDeclarations } from "@/lib/agent/tools";
import { env } from "./env";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey, httpOptions: { apiVersion: env.apiVersion } });
  return client;
}

/**
 * The full Live session config. It is baked into the ephemeral token
 * server-side, so the browser never sees (or can tamper with) the system
 * prompt, the tool list or the voice.
 */
export function liveSessionConfig(brandId?: string): LiveConnectConfig {
  const brand = getBrand(brandId);
  return {
    responseModalities: [Modality.AUDIO],
    systemInstruction: buildSystemInstruction(brand),
    tools: [{ functionDeclarations: toolDeclarations() }],
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: env.voice ?? brand.agent.voice } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    realtimeInputConfig: {
      automaticActivityDetection: {
        // ~500ms of silence ends the customer's turn: short enough to feel
        // responsive, long enough not to cut people off mid-thought
        // (e.g. while reading out an order number).
        silenceDurationMs: 500,
        prefixPaddingMs: 100,
      },
    },
    contextWindowCompression: { slidingWindow: {} },
  };
}
