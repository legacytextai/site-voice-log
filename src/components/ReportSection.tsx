import { type LogEntryData } from "./LogEntry";
import { toast } from "@/hooks/use-toast";

interface ReportSectionProps {
  entries: LogEntryData[];
  report: string | null;
  pdfUrl: string | null;
  userEmail: string;
  isGenerating: boolean;
  onGenerate: () => void;
}

const todayFormatted = () =>
  new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const ReportSection = ({
  entries,
  report,
  pdfUrl,
  userEmail,
  isGenerating,
  onGenerate,
}: ReportSectionProps) => {
  const hasEntries = entries.filter((e) => e.status === "saved").length > 0;

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      toast({ title: "Copied", description: "Report copied to clipboard" });
    } catch {
      toast({ title: "Error", description: "Failed to copy", variant: "destructive" });
    }
  };

  const handleEmail = () => {
    if (!report) return;
    const subject = encodeURIComponent(`SiteLog Daily Report – ${todayFormatted()}`);
    const body = encodeURIComponent(report);
    window.open(`mailto:${userEmail}?subject=${subject}&body=${body}`, "_self");
  };

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `SiteLog_Report_${new Date().toISOString().split("T")[0]}.pdf`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="w-full space-y-4">
      <button
        onClick={onGenerate}
        disabled={!hasEntries || isGenerating}
        className="w-full py-3.5 bg-foreground text-background text-sm font-medium tracking-wide uppercase rounded-lg transition-opacity duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:opacity-80"
      >
        {isGenerating ? "Generating…" : "Generate Daily Report"}
      </button>

      {report && (
        <div className="border border-border rounded-lg p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Daily Report
          </h3>
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {report}
          </div>

          <div className="flex gap-2 mt-4 pt-3 border-t border-border">
            {pdfUrl && (
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 bg-foreground text-background text-xs font-medium tracking-wide uppercase rounded-lg active:opacity-80"
              >
                Download PDF
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex-1 py-2.5 border border-border text-foreground text-xs font-medium tracking-wide uppercase rounded-lg active:opacity-80"
            >
              Copy Report
            </button>
            <button
              onClick={handleEmail}
              className="flex-1 py-2.5 border border-border text-foreground text-xs font-medium tracking-wide uppercase rounded-lg active:opacity-80"
            >
              Email Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportSection;
