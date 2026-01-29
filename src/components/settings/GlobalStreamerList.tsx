import { useState, useMemo } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import type { GlobalStreamer } from '@/types';
import { useStreamerDatabaseStore } from '@/stores';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GlobalStreamerCard } from './GlobalStreamerCard';
import { AddGlobalStreamerDialog } from './AddGlobalStreamerDialog';

export function GlobalStreamerList() {
  const { globalStreamers, removeGlobalStreamer } = useStreamerDatabaseStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStreamer, setEditingStreamer] = useState<GlobalStreamer | null>(null);
  const [deletingStreamer, setDeletingStreamer] = useState<GlobalStreamer | null>(null);

  // Filter streamers based on search query
  const filteredStreamers = useMemo(() => {
    if (!searchQuery.trim()) return globalStreamers;

    const query = searchQuery.toLowerCase();
    return globalStreamers.filter(
      (s) =>
        s.displayName.toLowerCase().includes(query) ||
        s.channel.toLowerCase().includes(query) ||
        s.notes?.toLowerCase().includes(query)
    );
  }, [globalStreamers, searchQuery]);

  const handleEdit = (streamer: GlobalStreamer) => {
    setEditingStreamer(streamer);
  };

  const handleDelete = (streamer: GlobalStreamer) => {
    setDeletingStreamer(streamer);
  };

  const confirmDelete = () => {
    if (deletingStreamer) {
      removeGlobalStreamer(deletingStreamer.id);
      setDeletingStreamer(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Global Streamers</h2>
          <p className="text-sm text-muted-foreground">
            Manage your streamer database. These can be reused across projects.
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Streamer
        </Button>
      </div>

      {/* Search */}
      {globalStreamers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search streamers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* List */}
      {globalStreamers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No streamers yet</h3>
          <p className="text-muted-foreground mb-6">
            Add streamers to your database to reuse them across projects.
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Your First Streamer
          </Button>
        </div>
      ) : filteredStreamers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No results found</h3>
          <p className="text-muted-foreground">
            No streamers match "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredStreamers.map((streamer) => (
            <GlobalStreamerCard
              key={streamer.id}
              streamer={streamer}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <AddGlobalStreamerDialog
        open={isAddDialogOpen || !!editingStreamer}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingStreamer(null);
          }
        }}
        editingStreamer={editingStreamer}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingStreamer} onOpenChange={() => setDeletingStreamer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Streamer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingStreamer?.displayName}"? This will also
              remove them from all presets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
