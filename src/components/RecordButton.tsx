import { cn } from "@/lib/utils";

interface RecordButtonProps {
  isRecording: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const RecordButton = ({ isRecording, onToggle, disabled }: RecordButtonProps) => {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={cn(
          "w-20 h-20 rounded-full bg-record flex items-center justify-center",
          "transition-transform duration-150 ease-out",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          isRecording && "scale-110"
        )}
      >
        <div
          className={cn(
            "bg-record-foreground transition-all duration-150",
            isRecording ? "w-6 h-6 rounded-sm" : "w-5 h-5 rounded-full"
          )}
        />
      </button>
      <span className="text-sm text-muted-foreground font-medium tracking-wide uppercase">
        {isRecording ? "Recording…" : "Tap to record"}
      </span>
    </div>
  );
};

export default RecordButton;
