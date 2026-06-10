"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Globe2,
  Plus,
  RadioTower,
  ShieldCheck,
  X,
} from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { CardHeader, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export function CreateSiteButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const createSite = api.sites.create.useMutation({
    onSuccess: (site) => {
      setOpen(false);
      setName("");
      setPrimaryUrl("");
      router.push(`/sites/${site.id}?view=setup&setup=1&tab=branding`);
      router.refresh();
    },
  });

  const normalizeHttps = (raw: string) => {
    const s = raw.trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    return `https://${s}`;
  };

  const parsedPrimaryUrl = (() => {
    const normalized = normalizeHttps(primaryUrl);
    if (!normalized) return null;
    try {
      const url = new URL(normalized);
      if (url.protocol !== "https:") return null;
      if (!url.hostname.includes(".")) return null;
      return url;
    } catch {
      return null;
    }
  })();

  const normalizedPrimaryUrl =
    parsedPrimaryUrl?.toString() ?? normalizeHttps(primaryUrl);
  const showUrlError = primaryUrl.trim().length > 0 && !parsedPrimaryUrl;

  const allowedDomains = parsedPrimaryUrl ? [parsedPrimaryUrl.host] : [];
  const canSubmit = Boolean(
    name.trim() && parsedPrimaryUrl && allowedDomains.length,
  );
  const detectedHost = parsedPrimaryUrl?.hostname.replace(/^www\./, "") ?? null;

  const previewItems = [
    {
      label: "Website URL",
      value: parsedPrimaryUrl ? normalizedPrimaryUrl : "Needed before setup",
      done: Boolean(parsedPrimaryUrl),
      icon: Globe2,
    },
    {
      label: "Allowed domain",
      value: allowedDomains[0] ?? "Inferred from the website URL",
      done: allowedDomains.length > 0,
      icon: ShieldCheck,
    },
    {
      label: "Knowledge",
      value: "Added during setup",
      done: false,
      icon: BookOpenCheck,
    },
    {
      label: "Publish state",
      value: "Draft until setup is complete",
      done: false,
      icon: RadioTower,
    },
  ];

  const closeModal = useCallback(() => {
    setOpen(false);
    createSite.reset();
  }, [createSite]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
        else closeModal();
      }}
    >
      <Dialog.Trigger asChild>
        <Button type="button">
          <Plus className="h-4 w-4" />
          New widget
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-gray-950/35 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100vh-2rem)] w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl focus:outline-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Create widget
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-gray-600">
                Start with the public website where the assistant will live. The
                first allowed domain is inferred here; knowledge sources, crawl
                groups, preview, and publishing happen in setup.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close"
                className="h-9 w-9 shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
              onSubmit={(e) => {
                e.preventDefault();
                if (!canSubmit) return;
                createSite.mutate({
                  name: name.trim(),
                  primaryUrl: normalizedPrimaryUrl,
                  allowedDomains,
                });
              }}
            >
              <div className="min-w-0 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-site-name">Widget name</Label>
                  <Input
                    id="new-site-name"
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (createSite.error) createSite.reset();
                    }}
                    placeholder="Product docs"
                  />
                  <p className="text-xs text-gray-500">
                    This is only shown inside your console; the visitor title
                    can be changed later.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-site-primary-url">
                    Website URL{" "}
                    <span className="font-normal text-gray-400">
                      (required)
                    </span>
                  </Label>
                  <div className="relative">
                    <Globe2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="new-site-primary-url"
                      value={primaryUrl}
                      onChange={(e) => {
                        setPrimaryUrl(e.target.value);
                        if (createSite.error) createSite.reset();
                      }}
                      onBlur={() => {
                        if (parsedPrimaryUrl)
                          setPrimaryUrl(parsedPrimaryUrl.toString());
                      }}
                      placeholder="https://docs.example.com"
                      aria-invalid={showUrlError}
                      aria-describedby="new-site-url-help"
                      className={`pl-9 ${showUrlError ? "border-red-300 focus:border-red-500 focus:ring-red-100" : ""}`}
                    />
                  </div>
                  {showUrlError ? (
                    <p className="text-xs font-medium text-red-600">
                      Enter a valid public https URL, like
                      https://docs.example.com.
                    </p>
                  ) : null}
                  <div
                    id="new-site-url-help"
                    className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-600 sm:grid-cols-2"
                  >
                    <div>
                      <span className="block font-medium text-gray-800">
                        Detected site
                      </span>
                      <span className="mt-0.5 block break-words">
                        {detectedHost ?? "Waiting for a valid URL"}
                      </span>
                    </div>
                    <div>
                      <span className="block font-medium text-gray-800">
                        Allowed domain
                      </span>
                      <span className="mt-0.5 block break-words">
                        {allowedDomains[0] ?? "Waiting for a valid URL"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm leading-6 text-blue-900">
                  After creation, setup opens to branding first. Knowledge groups
                  can include docs portals, live pages, crawl depth, page caps,
                  and schedules before anything goes live.
                </div>
              </div>

              <aside className="min-w-0 rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Creation preview
                </p>
                <div className="mt-3 space-y-3">
                  {previewItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex gap-3">
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                            item.done
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-gray-200 bg-gray-50 text-gray-500"
                          }`}
                        >
                          {item.done ? (
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                          ) : (
                            <Icon className="h-4 w-4" aria-hidden />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900">
                            {item.label}
                          </p>
                          <p className="mt-0.5 break-words text-xs leading-5 text-gray-500">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {createSite.error ? (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                    {createSite.error.message}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={!canSubmit || createSite.isPending}
                  className="mt-4 w-full justify-between shadow-sm"
                >
                  <span>
                    {createSite.isPending ? "Creating…" : "Create widget"}
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </aside>
            </form>
          </CardContent>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
