import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export type LogStatus = "saving" | "saved";

export interface LogEntryData {
  id: string;
  timestamp: Date;
  status: LogStatus;
  durationSeconds: number;
}

interface LogEntryProps {
  entry: LogEntryData;
  onDelete?: (id: string) => void;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const LogEntry = ({ entry, onDelete }: LogEntryProps) => {
  const handleDelete = () => {
    if (window.confirm("Delete this recording? This cannot be undone.")) {
      onDelete?.(entry.id);
    }
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatTime(entry.timestamp)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDuration(entry.durationSeconds)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "text-xs font-medium uppercase tracking-wider",
            entry.status === "saving" && "text-status-saving",
            entry.status === "saved" && "text-status-saved"
          )}
        >
          {entry.status === "saving" ? "Saving…" : "Saved"}
        </span>
        {entry.status === "saved" && onDelete && (
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Delete recording"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default LogEntry;
