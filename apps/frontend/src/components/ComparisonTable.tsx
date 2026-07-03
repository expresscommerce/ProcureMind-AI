import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge, RiskLevel } from "@/components/RiskBadge";

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
}

export function ComparisonTable({ features, vendors }: ComparisonTableProps) {
  return (
    <div className="border border-rule rounded-md overflow-hidden bg-surface">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[30%]">Evaluation Criteria</TableHead>
            {vendors.map(vendor => (
              <TableHead key={vendor.id} className="w-[35%]">
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
                <TableCell key={vendor.id}>
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
