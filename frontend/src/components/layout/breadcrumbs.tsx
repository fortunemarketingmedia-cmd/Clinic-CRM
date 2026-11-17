'use client';

import { ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigationSections } from '@/components/layout/sidebar';

const routeAliases: Record<string, string> = { '/patients': '/clients' };

function useCrumbs() {
  const rawPath = usePathname();
  const alias = Object.keys(routeAliases).find((prefix) => rawPath === prefix || rawPath.startsWith(`${prefix}/`));
  const pathname = alias ? rawPath.replace(alias, routeAliases[alias]) : rawPath;
  for (const section of navigationSections) {
    for (const item of section.items) {
      if (pathname === item.href) return { section: section.label, page: item.label, detail: false as const };
      if (pathname.startsWith(`${item.href}/`)) return { section: section.label, page: item.label, href: item.href, detail: true as const };
    }
  }
  return null;
}

/** Quiet context line above each page title: "▢ — Section / Page". */
export function Breadcrumbs() {
  const crumbs = useCrumbs();
  if (!crumbs) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground">
      <FileText className="size-3.5" aria-hidden />
      <span aria-hidden>—</span>
      {crumbs.section ? <><span>{crumbs.section}</span><ChevronRight className="size-3.5" aria-hidden /></> : null}
      {crumbs.detail ? (
        <><Link href={crumbs.href} className="hover:text-foreground">{crumbs.page}</Link><ChevronRight className="size-3.5" aria-hidden /><span className="text-foreground">Details</span></>
      ) : <span className="text-foreground">{crumbs.page}</span>}
    </nav>
  );
}
