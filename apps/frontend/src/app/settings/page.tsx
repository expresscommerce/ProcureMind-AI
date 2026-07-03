import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink mb-2">Settings</h1>
        <p className="text-ink-muted">Manage application preferences and user access.</p>
      </div>

      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Company Name</label>
              <input 
                type="text" 
                defaultValue="Acme Corp" 
                className="w-full h-10 px-3 rounded-sm border border-rule bg-surface text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Audit Fiscal Year End</label>
              <input 
                type="date" 
                defaultValue="2026-12-31" 
                className="w-full h-10 px-3 rounded-sm border border-rule bg-surface text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy font-mono tabular-nums"
              />
            </div>
            <Button>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="notif1" defaultChecked className="size-4 text-navy rounded-sm border-rule" />
              <label htmlFor="notif1" className="text-sm text-ink font-medium">New Discrepancies</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="notif2" defaultChecked className="size-4 text-navy rounded-sm border-rule" />
              <label htmlFor="notif2" className="text-sm text-ink font-medium">SLA Violations</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="notif3" className="size-4 text-navy rounded-sm border-rule" />
              <label htmlFor="notif3" className="text-sm text-ink font-medium">Weekly Audit Summary</label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
