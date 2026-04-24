"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function CreateSiteButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const router = useRouter();

  const createSite = api.sites.create.useMutation({
    onSuccess: (site) => {
      setOpen(false);
      setName("");
      setPrimaryUrl("");
      router.push(`/sites/${site.id}?setup=1&tab=branding`);
      router.refresh();
    },
  });

  const normalizeHttps = (raw: string) => {
    const s = raw.trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  const deriveAllowedDomains = (primaryUrlRaw: string) => {
    const set = new Set<string>();
    try {
      const u = new URL(normalizeHttps(primaryUrlRaw));
      if (u.host) set.add(u.host);
    } catch {
      // ignore
    }
    return [...set];
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New site</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl border-none">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Create new site</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Site name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Docs"
                  />
                </div>

                <div className="space-y-2">
                  <Label>
                    Primary URL{" "}
                    <span className="font-normal text-gray-400">(required)</span>
                  </Label>
                  <Input
                    value={primaryUrl}
                    onChange={(e) => setPrimaryUrl(normalizeHttps(e.target.value))}
                    placeholder="https://client.com"
                  />
                  <p className="text-xs text-gray-400">
                    Used for demo preview and favicon-based widget icon.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!name.trim()) return;
                    createSite.mutate({
                      name: name.trim(),
                      primaryUrl: normalizeHttps(primaryUrl),
                      allowedDomains: deriveAllowedDomains(primaryUrl),
                    });
                  }}
                  disabled={!name.trim() || !primaryUrl.trim() || createSite.isPending}
                >
                  {createSite.isPending ? "Creating…" : "Create"}
                </Button>
              </div>

              {createSite.error && (
                <p className="mt-3 text-xs text-red-600">
                  {createSite.error.message}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
