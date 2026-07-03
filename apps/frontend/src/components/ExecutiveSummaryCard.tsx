import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ExecutiveSummaryCardProps {
  title: string;
  value: string;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  className?: string;
}

export function ExecutiveSummaryCard({ title, value, trend, className }: ExecutiveSummaryCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-ink-muted font-sans tracking-wide uppercase">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-mono tabular-nums font-semibold text-ink">{value}</div>
        {trend && (
          <div className="mt-2 text-xs flex items-center gap-1">
            <span
              className={cn(
                "tabular-nums font-medium",
                trend.direction === "up" ? "text-verdigris" : 
                trend.direction === "down" ? "text-audit-red" : 
                "text-ink-muted"
              )}
            >
              {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "−"} {trend.value}
            </span>
            {trend.label && <span className="text-ink-muted">{trend.label}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
