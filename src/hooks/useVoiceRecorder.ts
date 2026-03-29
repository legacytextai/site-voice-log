import { useState, useRef, useCallback } from "react";
import { type LogEntryData } from "@/components/LogEntry";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [entries, setEntries] = useState<LogEntryData[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const id = crypto.randomUUID();

        // Add as "saving"
        setEntries((prev) => [
          { id, timestamp: new Date(), status: "saving" as const, durationSeconds: duration },
          ...prev,
        ]);

        // Simulate save (replace with Cloud persistence later)
        setTimeout(() => {
          setEntries((prev) =>
            prev.map((e) => (e.id === id ? { ...e, status: "saved" as const } : e))
          );
        }, 800);

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return { isRecording, entries, toggleRecording };
}
