import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useMontageStore } from '@/stores';

export function TransitionSettings() {
  const transitionDuration = useMontageStore((s) => s.transitionDuration);
  const setTransitionDuration = useMontageStore((s) => s.setTransitionDuration);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Durée du fade</Label>
          <span className="text-sm text-muted-foreground">
            {transitionDuration.toFixed(1)}s
          </span>
        </div>
        <Slider
          value={[transitionDuration]}
          onValueChange={(values) => setTransitionDuration(values[0])}
          min={0}
          max={2}
          step={0.1}
          className="mt-2"
        />
        <p className="text-xs text-muted-foreground mt-1">
          0 = pas de transition, 2 = fondu lent
        </p>
      </div>

      {/* Visual representation */}
      <div className="flex items-center justify-center gap-1 py-4">
        <div className="w-16 h-8 bg-primary/30 rounded-l flex items-center justify-center text-xs">
          Clip 1
        </div>
        <div 
          className="h-8 bg-gradient-to-r from-primary/30 to-secondary/30 flex items-center justify-center"
          style={{ width: `${Math.max(transitionDuration * 30, 4)}px` }}
        />
        <div className="w-16 h-8 bg-secondary/30 rounded-r flex items-center justify-center text-xs">
          Clip 2
        </div>
      </div>
    </div>
  );
}
