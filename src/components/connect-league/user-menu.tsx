'use client';

import { LogIn, LogOut, User } from 'lucide-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getAvatarWithGravatarFallback, getInitials } from '@/lib/gravatar';

interface UserMenuProps {
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  isPublicVisitor?: boolean;
  leagueSlug?: string;
}

export function UserMenu({ userName, userEmail, userAvatarUrl, isPublicVisitor = false, leagueSlug }: UserMenuProps) {
  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  // If this is a public visitor without authentication, show sign in button
  if (isPublicVisitor && !userName) {
    const callbackUrl = leagueSlug ? `/leagues/${leagueSlug}` : '/dashboard';
    return (
      <Button variant="default" size="sm" asChild>
        <Link href={`/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`}>
          <LogIn className="mr-2 h-4 w-4" />
          Sign In
        </Link>
      </Button>
    );
  }

  const displayName = userName || 'User';
  const avatarSrc = getAvatarWithGravatarFallback(userAvatarUrl, userEmail, { size: 64 });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={avatarSrc} alt={displayName} />
            <AvatarFallback className="text-xs">{getInitials(displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            {userEmail && <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
