import { useState } from "react";
import RecordButton from "@/components/RecordButton";
import LogList from "@/components/LogList";
import ReportSection from "@/components/ReportSection";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

const today = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const Index = () => {
  const { isRecording, entries, toggleRecording } = useVoiceRecorder();
  const [report, setReport] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = () => {
    setIsGenerating(true);
    // Mock report generation — will be replaced with Cloud AI transcription
    setTimeout(() => {
      const savedCount = entries.filter((e) => e.status === "saved").length;
      const totalDuration = entries
        .filter((e) => e.status === "saved")
        .reduce((sum, e) => sum + e.durationSeconds, 0);
      const minutes = Math.floor(totalDuration / 60);
      const seconds = totalDuration % 60;

      setReport(
        `DAILY SITE REPORT — ${today()}\n\n` +
          `Entries Recorded: ${savedCount}\n` +
          `Total Duration: ${minutes > 0 ? `${minutes}m ` : ""}${seconds}s\n\n` +
          `Summary:\n` +
          `${savedCount} voice log${savedCount !== 1 ? "s" : ""} captured on site today. ` +
          `Transcription and structured report generation requires Lovable Cloud integration.\n\n` +
          `— End of Report —`
      );
      setIsGenerating(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-5 pt-12 pb-6">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          SiteLog
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">{today()}</p>
      </header>

      {/* Record Button — centered vertically in available space */}
      <div className="flex-1 flex items-center justify-center px-5">
        <RecordButton isRecording={isRecording} onToggle={toggleRecording} />
      </div>

      {/* Logs + Report */}
      <div className="px-5 pb-8 space-y-6">
        <LogList entries={entries} />
        <ReportSection
          entries={entries}
          report={report}
          isGenerating={isGenerating}
          onGenerate={handleGenerateReport}
        />
      </div>
    </div>
  );
};

export default Index;
