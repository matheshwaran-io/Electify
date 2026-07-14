export function TimelineSlider({
  progress,
  max,
  value,
  onChange,
}: {
  progress: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex-1 relative h-6 flex items-center group">
      <div className="absolute inset-x-0 h-2 bg-[var(--accent)] rounded-full overflow-hidden">
        <div 
          className="h-full bg-indigo-500 transition-all duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="absolute inset-x-0 w-full h-full opacity-0 cursor-pointer z-10"
      />
      <div 
        className="absolute w-4 h-4 bg-white border-2 border-indigo-600 rounded-full shadow transition-all duration-300 ease-linear group-hover:scale-125"
        style={{ left: `calc(${progress}% - 0.5rem)` }}
      />
    </div>
  );
}
