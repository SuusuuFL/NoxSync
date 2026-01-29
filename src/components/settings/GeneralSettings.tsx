import { useEffect, useState } from 'react';
import { Folder, Download, Check, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSettingsStore, type BinaryInfo } from '@/stores';

function BinaryStatusBadge({ info }: { info: BinaryInfo }) {
  if (!info.installed) {
    return <Badge variant="destructive">Not Found</Badge>;
  }

  if (info.source === 'system') {
    return <Badge variant="secondary">System</Badge>;
  }

  return <Badge variant="default">Managed</Badge>;
}

function BinaryRow({
  displayName,
  info,
  onDownload,
  isDownloading,
}: {
  displayName: string;
  info: BinaryInfo | undefined;
  onDownload: () => void;
  isDownloading: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{displayName}</span>
          {info && <BinaryStatusBadge info={info} />}
        </div>
        {info?.version && (
          <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
            {info.version}
          </p>
        )}
        {info?.path && (
          <p className="text-xs text-muted-foreground truncate max-w-md">
            {info.path}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {info?.installed ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Button
            size="sm"
            onClick={onDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Download className="h-4 w-4 mr-1" />
            )}
            Download
          </Button>
        )}
      </div>
    </div>
  );
}

export function GeneralSettings() {
  const {
    workDir,
    binaryStatus,
    isLoading,
    error,
    loadSettings,
    pickWorkDir,
    checkBinaries,
    downloadBinary,
  } = useSettingsStore();

  const [downloadingBinary, setDownloadingBinary] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    checkBinaries();
  }, [loadSettings, checkBinaries]);

  const handlePickFolder = async () => {
    await pickWorkDir();
  };

  const handleDownload = async (binary: 'ffmpeg' | 'yt-dlp') => {
    setDownloadingBinary(binary);
    try {
      await downloadBinary(binary);
    } finally {
      setDownloadingBinary(null);
    }
  };

  const handleRefreshBinaries = () => {
    checkBinaries();
  };

  return (
    <div className="space-y-6">
      {/* Work Directory */}
      <Card>
        <CardHeader>
          <CardTitle>Work Directory</CardTitle>
          <CardDescription>
            Location where projects and exported clips are stored
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={workDir || 'Loading...'}
                disabled
                className="font-mono text-sm"
              />
            </div>
            <Button
              variant="outline"
              onClick={handlePickFolder}
              disabled={isLoading}
            >
              <Folder className="h-4 w-4 mr-2" />
              Browse
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </CardContent>
      </Card>

      {/* Binaries */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Required Binaries</CardTitle>
              <CardDescription>
                FFmpeg and yt-dlp are required for exporting clips
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshBinaries}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <BinaryRow
            displayName="FFmpeg"
            info={binaryStatus?.ffmpeg}
            onDownload={() => handleDownload('ffmpeg')}
            isDownloading={downloadingBinary === 'ffmpeg'}
          />
          <BinaryRow
            displayName="yt-dlp"
            info={binaryStatus?.ytdlp}
            onDownload={() => handleDownload('yt-dlp')}
            isDownloading={downloadingBinary === 'yt-dlp'}
          />
        </CardContent>
      </Card>
    </div>
  );
}
