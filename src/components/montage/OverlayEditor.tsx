import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useMontageStore } from '@/stores';
import { type OverlayPosition } from '@/types';

export function OverlayEditor() {
  const overlay = useMontageStore((s) => s.overlay);
  const setOverlay = useMontageStore((s) => s.setOverlay);
  const usePreset = useMontageStore((s) => s.usePreset);

  const handlePositionChange = (position: OverlayPosition) => {
    if (overlay) {
      setOverlay({ ...overlay, position });
    }
  };

  const handleFontSizeChange = (values: number[]) => {
    if (overlay) {
      setOverlay({ ...overlay, fontSize: values[0] });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Presets</Label>
        <div className="flex gap-2 mt-2">
          <Button
            variant={overlay?.type === 'streamer_name' ? 'default' : 'outline'}
            size="sm"
            onClick={() => usePreset('streamerName')}
          >
            Nom du streamer
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOverlay(null)}
          >
            Aucun
          </Button>
        </div>
      </div>

      {overlay && (
        <>
          <div>
            <Label className="text-sm font-medium">Position</Label>
            <Select
              value={overlay.position}
              onValueChange={(v) => handlePositionChange(v as OverlayPosition)}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Haut gauche</SelectItem>
                <SelectItem value="top-right">Haut droite</SelectItem>
                <SelectItem value="bottom-left">Bas gauche</SelectItem>
                <SelectItem value="bottom-right">Bas droite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Taille du texte</Label>
              <span className="text-sm text-muted-foreground">{overlay.fontSize}px</span>
            </div>
            <Slider
              value={[overlay.fontSize]}
              onValueChange={handleFontSizeChange}
              min={16}
              max={64}
              step={2}
              className="mt-2"
            />
          </div>

          {/* Preview */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Aperçu
            </Label>
            <div className="mt-2 aspect-video bg-muted rounded-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
              <div
                className="absolute px-3 py-1.5 bg-black/70 text-white rounded"
                style={{
                  fontSize: `${Math.min(overlay.fontSize / 2, 20)}px`,
                  ...(overlay.position === 'top-left' && { top: 8, left: 8 }),
                  ...(overlay.position === 'top-right' && { top: 8, right: 8 }),
                  ...(overlay.position === 'bottom-left' && { bottom: 8, left: 8 }),
                  ...(overlay.position === 'bottom-right' && { bottom: 8, right: 8 }),
                }}
              >
                {overlay.type === 'streamer_name' ? 'StreamerName' : overlay.text}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
