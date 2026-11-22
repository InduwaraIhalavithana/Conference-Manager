"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConferenceStatus } from "@/graphql/generated/graphql";
import { type ImageKind, UPLOAD_MAX_MB, uploadErrorText, uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

export type Texts = { en: string; si: string; ta: string };
export const EMPTY_TEXTS: Texts = { en: "", si: "", ta: "" };

export function textsFrom(value: { en: string; si?: string | null; ta?: string | null } | null | undefined): Texts {
  return { en: value?.en ?? "", si: value?.si ?? "", ta: value?.ta ?? "" };
}

/** For the API: trimmed, empty languages left out, or null when even English is empty. */
export function textsInput(value: Texts): { en: string; si: string | null; ta: string | null } | null {
  const en = value.en.trim();
  if (!en) return null;
  return { en, si: value.si.trim() || null, ta: value.ta.trim() || null };
}

const LANGS = [
  { code: "en", label: "English" },
  { code: "si", label: "සිංහල" },
  { code: "ta", label: "தமிழ்" },
] as const;

/** One text in three languages: language tabs over a single input or textarea. English is required. */
export function LocalizedField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 4,
  maxLength,
  required = false,
  placeholder,
  hint,
  invalid,
}: {
  label: string;
  value: Texts;
  onChange: (value: Texts) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  invalid?: boolean;
}) {
  const id = useId();
  const [lang, setLang] = useState<"en" | "si" | "ta">("en");
  const name = LANGS.find((l) => l.code === lang)?.label;
  const common = {
    id,
    value: value[lang],
    maxLength,
    placeholder: lang === "en" ? placeholder : undefined,
    "aria-invalid": invalid && lang === "en" ? true : undefined,
    "aria-describedby": hint ? `${id}-hint` : undefined,
    onChange: (e: { target: { value: string } }) => onChange({ ...value, [lang]: e.target.value }),
  };
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label} <span className="sr-only">({name})</span>
          {required && lang === "en" && <span className="text-destructive"> *</span>}
        </Label>
        <div className="flex gap-1" role="group" aria-label={label}>
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLang(l.code)}
              aria-pressed={lang === l.code}
              className={cn(
                "relative rounded-md px-2 py-0.5 text-xs font-medium transition",
                lang === l.code ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent",
              )}
            >
              {l.label}
              {l.code !== "en" && value[l.code].trim() && <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-success" aria-hidden />}
            </button>
          ))}
        </div>
      </div>
      {multiline ? (
        <textarea
          {...common}
          rows={rows}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30"
        />
      ) : (
        <Input {...common} className="h-11" />
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PUBLISHED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/15 text-destructive",
  ENDED: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
};

export function StatusBadge({ status, ended }: { status: ConferenceStatus; ended: boolean }) {
  const t = useTranslations();
  // ARCHIVED is in the data model but nothing sets it yet; it reads as ended.
  const key = (status === "PUBLISHED" && ended) || status === "ARCHIVED" ? "ENDED" : status;
  const label = { DRAFT: t("status_draft"), PUBLISHED: t("status_published"), CANCELLED: t("status_cancelled"), ENDED: t("status_ended") }[key];
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[key])}>{label}</span>;
}

/** Choose, replace or remove an image; it is uploaded straight away and `onChange` gets its address. */
export function ImagePicker({
  kind,
  value,
  onChange,
  label,
  help,
  shape = "wide",
}: {
  kind: ImageKind;
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  help?: string;
  shape?: "wide" | "square";
}) {
  const t = useTranslations();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const result = await uploadImage(kind, file);
    setBusy(false);
    if ("url" in result) {
      onChange(result.url);
      toast.success(t("upload_done"));
    } else toast.error(uploadErrorText(t, kind, file, result.error));
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-muted/40",
          shape === "wide" ? "aspect-[16/7] w-full" : "size-28",
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void pick(e.dataTransfer.files[0]);
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api${value}`} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="size-7 animate-spin text-white" aria-hidden />
          </span>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => {
        void pick(e.target.files?.[0]);
        e.target.value = "";
      }} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={busy} onClick={() => input.current?.click()}>
          <ImagePlus className="size-4" aria-hidden /> {value ? t("upload_replace") : t("upload_choose")}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" className="rounded-lg text-destructive" onClick={() => onChange(null)}>
            <Trash2 className="size-4" aria-hidden /> {t("upload_remove")}
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {help ? `${help} ` : ""}
          {t("upload_rules", { max: UPLOAD_MAX_MB[kind] })}
        </span>
      </div>
    </div>
  );
}

/** "Are you sure?" with a red confirm button. `onConfirm` resolves when done; the dialog then closes. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("close")}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
              onOpenChange(false);
            }}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
