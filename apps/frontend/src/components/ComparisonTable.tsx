import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge, RiskLevel } from "@/components/RiskBadge";
import { cn } from "@/lib/utils";

export interface ComparisonFeature {
  name: string;
  type: "text" | "cost" | "risk" | "numeric";
}

export interface ComparisonVendor {
  id: string;
  name: string;
  subtitle?: string;
  values: Record<string, string | RiskLevel>;
}

interface ComparisonTableProps {
  features: ComparisonFeature[];
  vendors: ComparisonVendor[];
  className?: string;
}

export function ComparisonTable({ features, vendors, className }: ComparisonTableProps) {
  const vendorWidth = `${75 / Math.max(1, vendors.length)}%`;

  return (
    <div className="border border-rule rounded-md overflow-hidden bg-surface">
      <Table className={cn("min-w-[720px]", className)}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[25%]">Evaluation Criteria</TableHead>
            {vendors.map(vendor => (
              <TableHead key={vendor.id} style={{ width: vendorWidth }}>
                <div className="font-medium text-ink">{vendor.name}</div>
                {vendor.subtitle && <div className="text-xs font-normal text-ink-muted mt-1">{vendor.subtitle}</div>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {features.map((feature, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium text-ink">{feature.name}</TableCell>
              {vendors.map(vendor => (
                <TableCell key={vendor.id} style={{ width: vendorWidth }}>
                  {feature.type === "risk" ? (
                    <RiskBadge level={vendor.values[feature.name] as RiskLevel} />
                  ) : (
                    <span className={feature.type === "cost" || feature.type === "numeric" ? "font-mono tabular-nums text-ink" : "text-ink"}>
                      {vendor.values[feature.name] as string}
                    </span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
