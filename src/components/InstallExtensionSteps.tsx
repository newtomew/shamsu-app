// Shared "how to install the Chrome extension" content — reused by the
// first-run welcome wizard and the dashboard's empty-state coaching card.
// Mirrors extension/README.md's actual "Load it in Chrome" steps so this
// never drifts from what the extension really requires (it isn't published
// to the Chrome Web Store yet — this is a real "Load unpacked" flow).

const STEPS = [
  { label: 'Open chrome://extensions in a new tab.' },
  { label: 'Turn on Developer mode (top-right toggle).' },
  { label: 'Click Load unpacked and select the extension/ folder.' },
  { label: '"Shamsu Recorder" appears — pin it to your toolbar for easy access.' },
];

export function InstallExtensionSteps() {
  return (
    <ol className="space-y-3">
      {STEPS.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-sm text-ink">
          <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-accent-light font-mono text-[11px] font-semibold text-accent">
            {i + 1}
          </span>
          <span className="pt-0.5">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
