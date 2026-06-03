"use client";

type Option<TValue extends string> = {
  label: string;
  value: TValue;
};

type PreferenceToggleGroupProps<TValue extends string> = {
  options: Array<Option<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
};

export function PreferenceToggleGroup<TValue extends string>({
  options,
  value,
  onChange,
}: PreferenceToggleGroupProps<TValue>) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-(--border-soft) bg-(--surface-2) p-1.5">
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={`min-h-10 rounded-full px-4 py-2 text-sm transition ${
              isActive
                ? "bg-(--button-primary-bg) text-(--button-primary-text) shadow-[0_12px_26px_var(--button-primary-shadow)]"
                : "text-(--text-secondary) hover:bg-(--surface-3) hover:text-(--text-primary)"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
