import { useState, useRef, useEffect } from "react";
import RecordButton from "@/components/RecordButton";
import LogList from "@/components/LogList";
import ReportSection from "@/components/ReportSection";
import EmailEntry from "@/components/EmailEntry";
import ProjectField from "@/components/ProjectField";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useUser } from "@/hooks/useUser";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const today = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const Index = () => {
  const { user, login, updateProjectName, isLoading: userLoading } = useUser();
  const { isRecording, entries, toggleRecording } = useVoiceRecorder(user?.id ?? null);
  const [report, setReport] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    if (!user) return;
    setIsGenerating(true);
    setReport(null);
    setPdfUrl(null);

    const savedIds = entries
      .filter((e) => e.status === "saved")
      .map((e) => e.id);

    try {
      const projectName = user.project_name?.trim() || "Untitled Project";
      const { data, error } = await supabase.functions.invoke(
        "generate-report",
        { body: { log_ids: savedIds, user_id: user.id, project_name: projectName } }
      );

      if (error) throw error;
      setReport(data.report.content);
      setPdfUrl(data.report.pdf_url || null);
    } catch (err) {
      console.error("Report generation failed:", err);
      setReport("Error generating report. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <EmailEntry onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-12 pb-6 space-y-4">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          SiteLog
        </h1>
        <ProjectField value={user.project_name} onSave={updateProjectName} />
        <p className="text-xs text-muted-foreground">{today()}</p>
      </header>

      <div className="flex-1 flex items-center justify-center px-5">
        <RecordButton isRecording={isRecording} onToggle={toggleRecording} />
      </div>

      <div className="px-5 pb-8 space-y-6">
        <LogList entries={entries} />
        <ReportSection
          entries={entries}
          report={report}
          pdfUrl={pdfUrl}
          userEmail={user.email}
          projectName={user.project_name?.trim() || "Untitled Project"}
          isGenerating={isGenerating}
          onGenerate={handleGenerateReport}
        />
      </div>
    </div>
  );
};

export default Index;
