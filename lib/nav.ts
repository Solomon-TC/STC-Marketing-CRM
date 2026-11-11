// Shared navigation structure: the top-level tabs (Navbar) and the pill
// sub-tabs shown above grouped pages (AppShell). Grouping is purely visual --
// every page keeps its own URL, so existing links (a contact's "Add to
// pipeline", a card link, a client's detail page) all still work.

export interface NavTab {
  href: string;
  label: string;
}

export const PIPELINE_TABS: NavTab[] = [
  { href: '/deals', label: 'Spotlights' },
  { href: '/website-deals', label: 'Websites' },
  { href: '/websites', label: 'Website Builds' },
];

export const TOOL_TABS: NavTab[] = [
  { href: '/contacts', label: 'Contacts' },
  { href: '/import', label: 'Import' },
  { href: '/websites/build-prompt', label: 'Build Prompt' },
  { href: '/websites/dns-reference', label: 'DNS Reference' },
  { href: '/websites/checklist-templates', label: 'Checklist Templates' },
];

function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

// Which group (and which sub-tab in it) a page belongs to. Tools are checked
// first because their URLs live under /websites/, which would otherwise read
// as a Website Builds page (/websites/<client id>).
export function findSubTab(pathname: string): { group: 'tools' | 'pipelines'; href: string } | null {
  const tool = TOOL_TABS.find((t) => matches(pathname, t.href));
  if (tool) return { group: 'tools', href: tool.href };
  const pipeline = PIPELINE_TABS.find((t) => matches(pathname, t.href));
  if (pipeline) return { group: 'pipelines', href: pipeline.href };
  return null;
}

export const MAIN_TABS: (NavTab & { isActive: (pathname: string) => boolean })[] = [
  { href: '/', label: 'Dashboard', isActive: (p) => p === '/' },
  { href: '/deals', label: 'Pipelines', isActive: (p) => findSubTab(p)?.group === 'pipelines' },
  { href: '/cards', label: 'Cards', isActive: (p) => matches(p, '/cards') },
  { href: '/finances', label: 'Finances', isActive: (p) => matches(p, '/finances') },
  { href: '/todo', label: 'To-Do', isActive: (p) => matches(p, '/todo') },
  { href: '/contacts', label: 'Tools', isActive: (p) => findSubTab(p)?.group === 'tools' },
];
