'use client';

import {
  BarChart3,
  CalendarDays,
  GitBranch,
  History,
  Home,
  ScrollText,
  Settings,
  Shield,
  Target,
  Trophy,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { leagueRoute } from '@/types/routes';

import type { UserRole } from '@/lib/auth/get-user-role';
import type { LeagueSubRoute } from '@/types/routes';

interface LeagueSidebarProps {
  leagueSlug: string;
  leagueName: string;
  leagueAvatarUrl?: string;
  userRole: UserRole;
  isPublicVisitor?: boolean;
}

interface NavItem {
  label: string;
  subRoute: LeagueSubRoute;
  icon: React.ComponentType<{ className?: string }>;
}

export function LeagueSidebar({ leagueSlug, leagueName, leagueAvatarUrl, userRole, isPublicVisitor = false }: LeagueSidebarProps) {
  const pathname = usePathname();

  const baseRoute = `/leagues/${leagueSlug}`;

  const mainNavItems: NavItem[] = [
    { label: 'Feed', subRoute: '/feed', icon: Home },
    { label: "Pick'ems", subRoute: '/pickems', icon: Target },
    { label: 'Rankings', subRoute: '/rankings', icon: BarChart3 },
    { label: 'Matchups', subRoute: '/matchups', icon: CalendarDays },
    { label: 'Brackets', subRoute: '/brackets', icon: GitBranch },
    { label: 'Leaderboard', subRoute: '/leaderboard', icon: Trophy },
    { label: 'Transactions', subRoute: '/transactions', icon: ScrollText },
  ];

  const leagueNavItems: NavItem[] = [
    { label: 'Teams', subRoute: '/teams', icon: UsersRound },
    { label: 'Members', subRoute: '/members', icon: Users },
    { label: 'History', subRoute: '/history', icon: History },
  ];

  const adminNavItems: NavItem[] = [];

  // Public visitors don't see admin items
  if (!isPublicVisitor) {
    // Commissioner can see Commissioner Desk
    if (userRole === 'commissioner') {
      adminNavItems.push({
        label: 'Commissioner Desk',
        subRoute: '/desk',
        icon: UserCog,
      });
    }

    // Admin (and commissioner who has admin privileges) can see Moderation and Settings
    if (userRole === 'admin' || userRole === 'commissioner') {
      adminNavItems.push({
        label: 'Moderation',
        subRoute: '/moderation',
        icon: Shield,
      });
      adminNavItems.push({
        label: 'Settings',
        subRoute: '/settings',
        icon: Settings,
      });
    }
  }

  const getHref = (subRoute: LeagueSubRoute) => `${baseRoute}${subRoute}`;

  const isActive = (subRoute: LeagueSubRoute) => {
    const href = getHref(subRoute);
    // For feed route, also match the base league route
    if (subRoute === '/feed') {
      return pathname === baseRoute || pathname === `${baseRoute}/` || pathname === `${baseRoute}/feed`;
    }
    // Prefix match for sub-routes
    return pathname.startsWith(href);
  };

  return (
    <Sidebar collapsible="icon" data-testid="mobile-nav-drawer">
      <SidebarHeader className="h-14 flex-row items-center gap-2 border-b border-sidebar-border group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:gap-0">
        <Link
          href={leagueRoute(leagueSlug, '/feed')}
          className="flex h-full items-center gap-3 px-2 transition-opacity hover:opacity-80 group-data-[state=collapsed]:hidden"
        >
          {leagueAvatarUrl ? (
            <img src={leagueAvatarUrl} alt={`${leagueName} logo`} className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-base">
              {leagueName.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <SidebarTrigger className="ml-auto hidden md:flex group-data-[state=collapsed]:ml-0" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.subRoute} data-testid="nav-item">
                  <SidebarMenuButton asChild isActive={isActive(item.subRoute)} tooltip={item.label}>
                    <Link href={leagueRoute(leagueSlug, item.subRoute)}>
                      <item.icon className="h-4 w-4" data-testid="nav-icon" aria-hidden="true" />
                      <span data-testid="nav-label">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>League</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {leagueNavItems.map((item) => (
                <SidebarMenuItem key={item.subRoute} data-testid="nav-item">
                  <SidebarMenuButton asChild isActive={isActive(item.subRoute)} tooltip={item.label}>
                    <Link href={leagueRoute(leagueSlug, item.subRoute)}>
                      <item.icon className="h-4 w-4" data-testid="nav-icon" aria-hidden="true" />
                      <span data-testid="nav-label">{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminNavItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminNavItems.map((item) => (
                    <SidebarMenuItem key={item.subRoute} data-testid="nav-item">
                      <SidebarMenuButton asChild isActive={isActive(item.subRoute)} tooltip={item.label}>
                        <Link href={leagueRoute(leagueSlug, item.subRoute)}>
                          <item.icon className="h-4 w-4" data-testid="nav-icon" aria-hidden="true" />
                          <span data-testid="nav-label">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
