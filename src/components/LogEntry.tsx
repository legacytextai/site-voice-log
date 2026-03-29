import { cn } from "@/lib/utils";

export type LogStatus = "saving" | "saved";

export interface LogEntryData {
  id: string;
  timestamp: Date;
  status: LogStatus;
  durationSeconds: number;
}

interface LogEntryProps {
  entry: LogEntryData;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const LogEntry = ({ entry }: LogEntryProps) => {
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
      <span
        className={cn(
          "text-xs font-medium uppercase tracking-wider",
          entry.status === "saving" && "text-status-saving",
          entry.status === "saved" && "text-status-saved"
        )}
      >
        {entry.status === "saving" ? "Saving…" : "Saved"}
      </span>
    </div>
  );
};

export default LogEntry;
