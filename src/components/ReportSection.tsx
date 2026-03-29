import { type LogEntryData } from "./LogEntry";

interface ReportSectionProps {
  entries: LogEntryData[];
  report: string | null;
  isGenerating: boolean;
  onGenerate: () => void;
}

const ReportSection = ({ entries, report, isGenerating, onGenerate }: ReportSectionProps) => {
  const hasEntries = entries.filter((e) => e.status === "saved").length > 0;

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
        </div>
      )}
    </div>
  );
};

export default ReportSection;
