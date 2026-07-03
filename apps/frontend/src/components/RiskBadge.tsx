import { Badge } from "@/components/ui/badge";

export type RiskLevel = "high" | "medium" | "low";

export function RiskBadge({ level, label }: { level: RiskLevel; label?: string }) {
  const getRiskStyles = (level: RiskLevel) => {
    switch (level) {
      case "high":
        return "bg-risk-high text-surface hover:bg-risk-high/90 border-transparent";
      case "medium":
        return "bg-risk-medium text-surface hover:bg-risk-medium/90 border-transparent";
      case "low":
        return "bg-verdigris text-surface hover:bg-verdigris/90 border-transparent";
    }
  };

  const defaultLabels = {
    high: "High Risk",
    medium: "Medium Risk",
    low: "Compliant",
  };

  return (
    <Badge variant="outline" className={getRiskStyles(level)}>
      {label || defaultLabels[level]}
    </Badge>
  );
}
