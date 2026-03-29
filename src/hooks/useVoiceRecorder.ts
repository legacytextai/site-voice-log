import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type LogEntryData, type LogStatus } from "@/components/LogEntry";

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [entries, setEntries] = useState<LogEntryData[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);

  // Load today's logs on mount
  useEffect(() => {
    const loadTodayLogs = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("voice_logs")
        .select("*")
        .gte("recorded_at", todayStart.toISOString())
        .order("recorded_at", { ascending: false });

      if (error) {
        console.error("Failed to load logs:", error);
        return;
      }

      if (data) {
        setEntries(
          data.map((log) => ({
            id: log.id,
            timestamp: new Date(log.recorded_at),
            status: (log.status === "saving" ? "saving" : "saved") as LogStatus,
            durationSeconds: log.duration_seconds,
          }))
        );
      }
    };

    loadTodayLogs();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const duration = Math.round(
          (Date.now() - startTimeRef.current) / 1000
        );
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const tempId = crypto.randomUUID();
        const audioPath = `${new Date().toISOString().split("T")[0]}/${tempId}.webm`;

        // Add to UI immediately as "saving"
        setEntries((prev) => [
          {
            id: tempId,
            timestamp: new Date(),
            status: "saving" as LogStatus,
            durationSeconds: duration,
          },
          ...prev,
        ]);

        try {
          // Upload audio to storage
          const { error: uploadError } = await supabase.storage
            .from("recordings")
            .upload(audioPath, blob, {
              contentType: "audio/webm",
            });

          if (uploadError) throw uploadError;

          // Insert log record
          const { data: logData, error: insertError } = await supabase
            .from("voice_logs")
            .insert({
              duration_seconds: duration,
              audio_path: audioPath,
              status: "saved",
            })
            .select()
            .single();

          if (insertError) throw insertError;

          // Update UI with real ID and saved status
          setEntries((prev) =>
            prev.map((e) =>
              e.id === tempId
                ? {
                    ...e,
                    id: logData.id,
                    status: "saved" as LogStatus,
                  }
                : e
            )
          );
        } catch (err) {
          console.error("Failed to save recording:", err);
          // Still mark as saved locally so UI isn't stuck
          setEntries((prev) =>
            prev.map((e) =>
              e.id === tempId ? { ...e, status: "saved" as LogStatus } : e
            )
          );
        }

        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
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
