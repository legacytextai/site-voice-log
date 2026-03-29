import LogEntry, { type LogEntryData } from "./LogEntry";

interface LogListProps {
  entries: LogEntryData[];
}

const LogList = ({ entries }: LogListProps) => {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No logs yet today.
      </p>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        Today's Logs
      </h2>
      <div>
        {entries.map((entry) => (
          <LogEntry key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
};

export default LogList;
