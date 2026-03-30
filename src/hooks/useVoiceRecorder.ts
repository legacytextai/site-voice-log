import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type LogEntryData, type LogStatus } from "@/components/LogEntry";

export function useVoiceRecorder(userId: string | null, userEmail?: string | null) {
  const [isRecording, setIsRecording] = useState(false);
  const [entries, setEntries] = useState<LogEntryData[]>([]);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const selectedMimeRef = useRef<string>("");

  const getMimeInfo = (mime: string) => {
    if (mime.includes("mp4")) return { ext: ".mp4", contentType: "audio/mp4" };
    if (mime.includes("webm")) return { ext: ".webm", contentType: "audio/webm" };
    return { ext: ".webm", contentType: "audio/webm" };
  };

  const addDebug = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    const line = `[${ts}] ${msg}`;
    console.log("[DEBUG]", line);
    setDebugLogs((prev) => [...prev, line]);
  }, []);

  // Load today's logs on mount (filtered by userId)
  useEffect(() => {
    if (!userId) return;

    const loadTodayLogs = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from("voice_logs")
        .select("*")
        .eq("user_id", userId)
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
  }, [userId]);

  const startRecording = useCallback(async () => {
    if (!userId) return;

    addDebug("[1] Record button clicked");
    addDebug(`[2] UserAgent: ${navigator.userAgent}`);
    addDebug(`[2] MediaRecorder exists: ${typeof MediaRecorder !== "undefined"}`);

    if (typeof MediaRecorder !== "undefined") {
      addDebug(`[3] isTypeSupported("audio/webm;codecs=opus"): ${MediaRecorder.isTypeSupported("audio/webm;codecs=opus")}`);
      addDebug(`[3] isTypeSupported("audio/mp4"): ${MediaRecorder.isTypeSupported("audio/mp4")}`);
      addDebug(`[3] isTypeSupported("audio/aac"): ${MediaRecorder.isTypeSupported("audio/aac")}`);
    } else {
      addDebug("[3] MediaRecorder not available — skipping isTypeSupported checks");
    }

    try {
      addDebug("[4] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addDebug(`[5] Microphone stream acquired (tracks: ${stream.getAudioTracks().length})`);

      // Negotiate mimeType
      let mediaRecorder: MediaRecorder;
      const candidates = ["audio/webm;codecs=opus", "audio/mp4"];
      const supported = candidates.find((m) => MediaRecorder.isTypeSupported(m));

      if (supported) {
        addDebug(`[6] Creating MediaRecorder with "${supported}"`);
        mediaRecorder = new MediaRecorder(stream, { mimeType: supported });
        selectedMimeRef.current = supported;
      } else {
        addDebug("[6] No preferred mimeType supported — using browser default");
        mediaRecorder = new MediaRecorder(stream);
        selectedMimeRef.current = mediaRecorder.mimeType || "";
      }
      addDebug(`[7] MediaRecorder created, runtime mimeType: "${mediaRecorder.mimeType}"`);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = (e) => {
        const errEvent = e as Event & { error?: DOMException };
        addDebug(`[ERR] MediaRecorder.onerror: ${errEvent.error?.name ?? "unknown"}: ${errEvent.error?.message ?? "unknown"}`);
        console.error("MediaRecorder onerror:", errEvent.error);
      };

      mediaRecorder.onstop = async () => {
        const duration = Math.round(
          (Date.now() - startTimeRef.current) / 1000
        );
        const { ext, contentType } = getMimeInfo(selectedMimeRef.current);
        const blob = new Blob(chunksRef.current, { type: selectedMimeRef.current || "audio/webm" });
        const tempId = crypto.randomUUID();
        const dateFolder = new Date().toISOString().split("T")[0];
        const userFolder = userEmail || userId || "unknown";
        const audioPath = `${dateFolder}/${userFolder}/${tempId}${ext}`;

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
          const { error: uploadError } = await supabase.storage
            .from("recordings")
            .upload(audioPath, blob, { contentType });

          if (uploadError) throw uploadError;

          const { data: logData, error: insertError } = await supabase
            .from("voice_logs")
            .insert({
              duration_seconds: duration,
              audio_path: audioPath,
              status: "saved",
              user_id: userId,
            })
            .select()
            .single();

          if (insertError) throw insertError;

          setEntries((prev) =>
            prev.map((e) =>
              e.id === tempId
                ? { ...e, id: logData.id, status: "saved" as LogStatus }
                : e
            )
          );
        } catch (err) {
          console.error("Failed to save recording:", err);
          setEntries((prev) =>
            prev.map((e) =>
              e.id === tempId ? { ...e, status: "saved" as LogStatus } : e
            )
          );
        }

        stream.getTracks().forEach((t) => t.stop());
      };

      addDebug("[8] Calling recorder.start()");
      mediaRecorder.start();
      addDebug(`[9] Recorder started, state: ${mediaRecorder.state}`);
      setIsRecording(true);
    } catch (err: unknown) {
      const error = err as Error;
      addDebug(`[ERR] ${error.name}: ${error.message}`);
      console.error("Recording failed:", err);
    }
  }, [userId, addDebug]);

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

  return { isRecording, entries, toggleRecording, debugLogs };
}
