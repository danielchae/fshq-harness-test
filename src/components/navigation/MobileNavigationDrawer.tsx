'use client';

import {
  BarChart3,
  CalendarDays,
  GitBranch,
  History,
  Home,
  ListChecks,
  ScrollText,
  Settings,
  Shield,
  Target,
  Trophy,
  UserCog,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { leagueRoute } from '@/types/routes';

import type { UserRole } from '@/lib/auth/get-user-role';
import type { LeagueSubRoute } from '@/types/routes';

interface NavItem {
  label: string;
  subRoute: LeagueSubRoute;
  icon: React.ComponentType<{ className?: string }>;
}

interface MobileNavigationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leagueSlug: string;
  leagueName: string;
  leagueAvatarUrl?: string;
  userRole: UserRole;
  userName?: string;
  userAvatarUrl?: string;
}

export function MobileNavigationDrawer({
  open,
  onOpenChange,
  leagueSlug,
  leagueName,
  leagueAvatarUrl,
  userRole,
  userName = 'User',
  userAvatarUrl,
}: MobileNavigationDrawerProps) {
  const pathname = usePathname();
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const touchStartX = React.useRef<number>(0);
  const touchCurrentX = React.useRef<number>(0);
  const isDragging = React.useRef<boolean>(false);

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

  const getHref = (subRoute: LeagueSubRoute) => `${baseRoute}${subRoute}`;

  const isActive = (subRoute: LeagueSubRoute) => {
    const href = getHref(subRoute);
    // For feed route, check both with and without /feed suffix
    if (subRoute === '/feed') {
      return pathname === baseRoute || pathname === `${baseRoute}/` || pathname === `${baseRoute}/feed`;
    }
    // Prefix match for sub-routes
    return pathname.startsWith(href);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleNavItemClick = () => {
    onOpenChange(false);
  };

  // Touch event handlers for swipe gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartX.current = touch.clientX;
      touchCurrentX.current = touch.clientX;
      isDragging.current = true;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const touch = e.touches[0];
    if (touch) {
      touchCurrentX.current = touch.clientX;
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const swipeDistance = touchStartX.current - touchCurrentX.current;
    const SWIPE_THRESHOLD = 50; // Minimum swipe distance to trigger close

    // If swiped left more than threshold, close the drawer
    if (swipeDistance > SWIPE_THRESHOLD) {
      onOpenChange(false);
    }
  };

  // Mouse event handlers for swipe gesture (for desktop testing)
  const handleMouseDown = (e: React.MouseEvent) => {
    touchStartX.current = e.clientX;
    touchCurrentX.current = e.clientX;
    isDragging.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    touchCurrentX.current = e.clientX;
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const swipeDistance = touchStartX.current - touchCurrentX.current;
    const SWIPE_THRESHOLD = 50;

    if (swipeDistance > SWIPE_THRESHOLD) {
      onOpenChange(false);
    }
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[280px] p-0 [&>button]:hidden"
        data-testid="mobile-nav-drawer"
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation Menu</SheetTitle>
        </SheetHeader>

        {/* Header with League Info */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {leagueAvatarUrl ? (
              <img src={leagueAvatarUrl} alt={`${leagueName} logo`} className="h-10 w-10 rounded-md object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
                {leagueName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate">{leagueName}</span>
              <span className="text-xs text-muted-foreground">Fantasy League</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Close navigation menu">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation Content */}
        <div className="flex flex-col flex-1 overflow-auto">
          {/* Main Navigation */}
          <nav className="flex flex-col p-2">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              Navigation
            </div>
            <ul className="flex flex-col gap-1">
              {mainNavItems.map((item) => (
                <li key={item.subRoute}>
                  <Link
                    href={leagueRoute(leagueSlug, item.subRoute)}
                    onClick={handleNavItemClick}
                    data-testid="nav-item"
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive(item.subRoute) ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/50'
                    )}
                  >
                    <item.icon className="h-5 w-5" data-testid="nav-icon" />
                    <span data-testid="nav-label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* League Navigation */}
          <Separator className="my-2" />
          <nav className="flex flex-col p-2">
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
              <UsersRound className="h-4 w-4" />
              League
            </div>
            <ul className="flex flex-col gap-1">
              {leagueNavItems.map((item) => (
                <li key={item.subRoute}>
                  <Link
                    href={leagueRoute(leagueSlug, item.subRoute)}
                    onClick={handleNavItemClick}
                    data-testid="nav-item"
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive(item.subRoute) ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent/50'
                    )}
                  >
                    <item.icon className="h-5 w-5" data-testid="nav-icon" />
                    <span data-testid="nav-label">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Admin Navigation */}
          {adminNavItems.length > 0 && (
            <>
              <Separator className="my-2" />
              <nav className="flex flex-col p-2">
                <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  Administration
                </div>
                <ul className="flex flex-col gap-1">
                  {adminNavItems.map((item) => (
                    <li key={item.subRoute}>
                      <Link
                        href={leagueRoute(leagueSlug, item.subRoute)}
                        onClick={handleNavItemClick}
                        data-testid="nav-item"
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                          isActive(item.subRoute)
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'hover:bg-accent/50'
                        )}
                      >
                        <item.icon className="h-5 w-5" data-testid="nav-icon" />
                        <span data-testid="nav-label">{item.label}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </>
          )}
        </div>

        {/* Footer with User Profile */}
        <div className="border-t p-4">
          <Link
            href="/profile"
            onClick={handleNavItemClick}
            data-testid="nav-item"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent/50"
          >
            <Avatar className="h-8 w-8" data-testid="nav-icon">
              <AvatarImage src={userAvatarUrl} alt={userName} />
              <AvatarFallback className="text-xs">{getInitials(userName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0" data-testid="nav-label">
              <span className="font-medium truncate">{userName}</span>
              <span className="text-xs text-muted-foreground">View Profile</span>
            </div>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
