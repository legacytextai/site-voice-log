import { useState, useEffect, useRef, useCallback } from "react";

interface ProjectFieldProps {
  value: string | null;
  onSave: (name: string) => Promise<void>;
}

const ProjectField = ({ value, onSave }: ProjectFieldProps) => {
  const [localValue, setLocalValue] = useState(value ?? "");
  const [showSaved, setShowSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(value ?? "");

  useEffect(() => {
    setLocalValue(value ?? "");
    lastSavedRef.current = value ?? "";
  }, [value]);

  const save = useCallback(
    async (v: string) => {
      const trimmed = v.trim();
      if (trimmed === lastSavedRef.current) return;
      lastSavedRef.current = trimmed;
      await onSave(trimmed);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    },
    [onSave]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(v), 800);
  };

  const handleBlur = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    save(localValue);
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Project / Job #
        </label>
        {showSaved && (
          <span className="text-[10px] text-muted-foreground/70 animate-pulse">
            Saved
          </span>
        )}
      </div>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Sunset Villas – PW-24-018"
        className="w-full bg-transparent border-b border-border text-sm text-foreground placeholder:text-muted-foreground/40 py-1.5 outline-none focus:border-foreground transition-colors"
      />
    </div>
  );
};

export default ProjectField;
