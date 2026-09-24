export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Hide the group label visually (still announced). */
  hideLabel?: boolean;
}

/** A group of toggle buttons (one pressed). Uses aria-pressed for broad VoiceOver support. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  hideLabel = true,
}: Props<T>) {
  return (
    <div role="group" aria-label={hideLabel ? label : undefined}>
      {!hideLabel && <span class="field-label">{label}</span>}
      <div class="segmented">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
