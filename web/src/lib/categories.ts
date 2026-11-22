import {
  Briefcase,
  Cpu,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  type LucideIcon,
  Palette,
  Sparkles,
} from "lucide-react";

import type { Category } from "@/graphql/generated/graphql";

type CategoryStyle = {
  /** Message key (the v2 keys are kept, so the reviewed Sinhala and Tamil wording is reused). */
  label: string;
  icon: LucideIcon;
  /** Text colour, soft background and border in the category's colour. */
  chip: string;
  /** Gradient used where a conference has no cover image. */
  cover: string;
  slug: string;
};

export const CATEGORIES: Record<Category, CategoryStyle> = {
  TECH: { label: "cat_Tech", icon: Cpu, chip: "text-cat-tech bg-cat-tech/12 border-cat-tech/30", cover: "from-sky-500 to-indigo-600", slug: "tech" },
  HEALTH: { label: "cat_Health", icon: HeartPulse, chip: "text-cat-health bg-cat-health/12 border-cat-health/30", cover: "from-emerald-500 to-teal-600", slug: "health" },
  EDUCATION: { label: "cat_Education", icon: GraduationCap, chip: "text-cat-education bg-cat-education/12 border-cat-education/30", cover: "from-violet-500 to-purple-700", slug: "education" },
  BUSINESS: { label: "cat_Business", icon: Briefcase, chip: "text-cat-business bg-cat-business/12 border-cat-business/30", cover: "from-orange-500 to-rose-600", slug: "business" },
  SCIENCE: { label: "cat_Science", icon: FlaskConical, chip: "text-cat-science bg-cat-science/12 border-cat-science/30", cover: "from-teal-500 to-cyan-700", slug: "science" },
  ARTS: { label: "cat_Arts", icon: Palette, chip: "text-cat-arts bg-cat-arts/12 border-cat-arts/30", cover: "from-pink-500 to-fuchsia-700", slug: "arts" },
  OTHER: { label: "cat_Other", icon: Sparkles, chip: "text-cat-other bg-cat-other/12 border-cat-other/30", cover: "from-slate-500 to-slate-700", slug: "other" },
};

export const CATEGORY_ORDER: Category[] = ["TECH", "HEALTH", "EDUCATION", "BUSINESS", "SCIENCE", "ARTS", "OTHER"];

export function categoryFromSlug(slug: string | undefined | null): Category | undefined {
  return CATEGORY_ORDER.find((c) => CATEGORIES[c].slug === slug);
}
