// Hooks de voz (PRD D10): TTS via Web Speech API (listening usa o transcript como áudio real)
// e captura de fala via SpeechRecognition (quando o navegador suporta). Somente em efeitos —
// nunca durante o render de SSR.
import { useCallback, useEffect, useRef, useState } from "react";

interface TtsState {
  supported: boolean;
  speaking: boolean;
  voiceName: string | null;
}

export function useTts() {
  const [state, setState] = useState<TtsState>({
    supported: false,
    speaking: false,
    voiceName: null,
  });

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const update = () => {
      const voices = synth.getVoices();
      const english = voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
      setState({
        supported: true,
        speaking: synth.speaking,
        voiceName: english ? english.name : (voices[0]?.name ?? null),
      });
    };
    update();
    synth.addEventListener("voiceschanged", update);
    return () => synth.removeEventListener("voiceschanged", update);
  }, []);

  const speak = useCallback((text: string): boolean => {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const english = voices.find((v) => v.lang.toLowerCase().startsWith("en"));
    if (english) utterance.voice = english;
    utterance.lang = english?.lang ?? "en-US";
    utterance.onend = () => setState((s) => ({ ...s, speaking: false }));
    utterance.onerror = () => setState((s) => ({ ...s, speaking: false }));
    setState((s) => ({ ...s, speaking: true }));
    synth.speak(utterance);
    return true;
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setState((s) => ({ ...s, speaking: false }));
  }, []);

  return { ...state, speak, stop };
}

type RecognitionResult = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function useSpeechInput() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<RecognitionLike | null>(null);

  useEffect(() => {
    const scope = window as unknown as Record<string, unknown>;
    setSupported(Boolean(scope["SpeechRecognition"] ?? scope["webkitSpeechRecognition"]));
  }, []);

  const start = useCallback(() => {
    const scope = window as unknown as Record<string, unknown>;
    const Ctor = (scope["SpeechRecognition"] ?? scope["webkitSpeechRecognition"]) as
      (new () => RecognitionLike) | undefined;
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      let finals = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result?.isFinal) finals += `${result[0].transcript} `;
      }
      if (finals) setTranscript((prev) => `${prev} ${finals}`.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => setTranscript(""), []);

  return { supported, listening, transcript, setTranscript, start, stop, reset };
}
