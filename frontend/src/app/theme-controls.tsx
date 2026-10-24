import { Moon, Sun, Laptop, Palette } from 'lucide-react'
import { useTheme, type ThemePalette, type ThemeMode } from './theme'

const PALETTES: { id: ThemePalette; name: string; color: string }[] = [
  { id: 'default', name: 'Slate', color: '#3b82f6' },
  { id: 'dhbw', name: 'DHBW', color: '#e11d48' },
  { id: 'emerald', name: 'Mint', color: '#10b981' },
  { id: 'purple', name: 'Violet', color: '#a855f7' },
]

const MODES: { id: ThemeMode; icon: typeof Sun; label: string }[] = [
  { id: 'light', icon: Sun, label: 'Light' },
  { id: 'dark', icon: Moon, label: 'Dark' },
  { id: 'system', icon: Laptop, label: 'System' },
]

export function ThemeControls() {
  const { mode, palette, setMode, setPalette } = useTheme()

  return (
    <div className="space-y-3">
      {/* Palette Selection */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 font-medium">
          <Palette className="h-3.5 w-3.5" />
          <span>Color Accent</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              onClick={() => setPalette(p.id)}
              className={`flex flex-col items-center gap-1 p-1 rounded-md text-[10px] transition ${
                palette === p.id
                  ? 'bg-primary/20 font-semibold text-foreground ring-1 ring-primary'
                  : 'hover:bg-accent/40 text-muted-foreground'
              }`}
            >
              <span
                className="h-3.5 w-3.5 rounded-full shadow-sm"
                style={{ backgroundColor: p.color }}
              />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mode Selection */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5 font-medium">
          <Moon className="h-3.5 w-3.5" />
          <span>Theme Mode</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((m) => {
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center justify-center gap-1 py-1 rounded-md text-xs transition ${
                  mode === m.id
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'hover:bg-accent/40 text-muted-foreground'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{m.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
