import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle: string;
  highlight?: boolean;
  className?: string; // Allow customization
}

export function StatCard({ icon: Icon, label, value, subtitle, highlight, className }: StatCardProps) {
  return (
    <Card className={`${highlight ? 'border-primary/50' : ''} ${className || ''}`}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${highlight ? 'bg-primary/10' : 'bg-muted'}`}>
            <Icon className={`h-4 w-4 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
            <div className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
