/**
 * Email Service
 *
 * Handles email notifications using Resend.
 * Provides type-safe email templates for all notification types.
 *
 * Configuration:
 * - RESEND_API_KEY: API key from Resend dashboard
 * - EMAIL_FROM: Sender email address (e.g., notifications@fshq.gg)
 *
 * @module src/lib/email
 */

import { Resend } from 'resend';

// Initialize Resend client (only if API key is available)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// Default sender email
const DEFAULT_FROM = process.env.EMAIL_FROM || 'FSHQ <notifications@fshq.gg>';

// Check if email sending is enabled
export function isEmailEnabled(): boolean {
  return !!resend;
}

// Email result type
export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

// Base email input
interface BaseEmailInput {
  to: string;
  subject: string;
}

/**
 * Send a raw email with HTML content
 */
export async function sendEmail(input: BaseEmailInput & { html: string }): Promise<EmailResult> {
  if (!resend) {
    console.log(`[Email] Resend not configured. Would send to ${input.to}: ${input.subject}`);
    return { success: true, id: 'mock-' + Date.now() };
  }

  try {
    const result = await resend.emails.send({
      from: DEFAULT_FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
    });

    if (result.error) {
      console.error('[Email] Failed to send:', result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// =============================================================================
// Email Templates
// =============================================================================

/**
 * Base HTML template wrapper
 */
function wrapInTemplate(content: string, preheader: string = ''): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>FSHQ Notification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 32px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
      text-decoration: none;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 16px 0;
      color: #1a1a1a;
    }
    p {
      margin: 0 0 16px 0;
      color: #4b5563;
    }
    .button {
      display: inline-block;
      background: #2563eb;
      color: white !important;
      padding: 12px 24px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 500;
      margin: 16px 0;
    }
    .button:hover {
      background: #1d4ed8;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      font-size: 12px;
      color: #9ca3af;
    }
    .preheader {
      display: none !important;
      visibility: hidden;
      opacity: 0;
      color: transparent;
      height: 0;
      width: 0;
    }
    .highlight {
      background: #fef3c7;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .stats {
      display: flex;
      justify-content: space-around;
      text-align: center;
      margin: 24px 0;
    }
    .stat {
      padding: 0 16px;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #2563eb;
    }
    .stat-label {
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <span class="preheader">${preheader}</span>
  <div class="container">
    <div class="card">
      <div class="header">
        <a href="https://fshq.gg" class="logo">🏈 FSHQ</a>
      </div>
      ${content}
      <div class="footer">
        <p>You received this email because you have notifications enabled for your FSHQ account.</p>
        <p><a href="https://fshq.gg/profile">Manage notification preferences</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate base URL for links
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : 'https://fshq.gg';
}

// =============================================================================
// Notification Email Templates
// =============================================================================

export interface PickReminderEmailInput {
  to: string;
  userName: string;
  leagueName: string;
  leagueSlug: string;
  weekNumber: number;
  unpickedCount: number;
  totalMatchups: number;
}

export async function sendPickReminderEmail(input: PickReminderEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/leagues/${input.leagueSlug}/pickems`;
  
  const content = `
    <h1>🎯 Don't Forget Your Picks!</h1>
    <p>Hey ${input.userName},</p>
    <p>You have <strong>${input.unpickedCount} unpicked matchup${input.unpickedCount > 1 ? 's' : ''}</strong> for Week ${input.weekNumber} in ${input.leagueName}.</p>
    <div class="highlight">
      <p style="margin: 0;"><strong>⏰ Time is running out!</strong> Make sure to submit your picks before the games start.</p>
    </div>
    <p style="text-align: center;">
      <a href="${link}" class="button">Make Your Picks</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">Progress: ${input.totalMatchups - input.unpickedCount} of ${input.totalMatchups} picks made</p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `⏰ ${input.unpickedCount} Unpicked Matchup${input.unpickedCount > 1 ? 's' : ''} - Week ${input.weekNumber} | FSHQ`,
    html: wrapInTemplate(content, `Don't forget! You have ${input.unpickedCount} picks to make for Week ${input.weekNumber}.`),
  });
}

export interface StatCorrectionEmailInput {
  to: string;
  userName: string;
  leagueName: string;
  leagueSlug: string;
  weekNumber: number;
  previousResult: boolean;
  newResult: boolean;
  matchupDescription?: string;
}

export async function sendStatCorrectionEmail(input: StatCorrectionEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/leagues/${input.leagueSlug}/pickems`;
  const resultChanged = input.previousResult !== input.newResult;
  
  let resultText: string;
  if (resultChanged) {
    resultText = input.newResult 
      ? '🎉 Good news! One of your picks is now <strong>correct</strong>!'
      : '😔 Unfortunately, one of your picks is now <strong>incorrect</strong>.';
  } else {
    resultText = 'Your pick results remain unchanged.';
  }
  
  const content = `
    <h1>📊 Stat Correction Applied</h1>
    <p>Hey ${input.userName},</p>
    <p>A stat correction has been applied to Week ${input.weekNumber} in ${input.leagueName}.</p>
    <div class="highlight">
      <p style="margin: 0;">${resultText}</p>
    </div>
    ${input.matchupDescription ? `<p style="font-size: 14px; color: #6b7280;">Affected matchup: ${input.matchupDescription}</p>` : ''}
    <p style="text-align: center;">
      <a href="${link}" class="button">View Pick Results</a>
    </p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `📊 Stat Correction - Week ${input.weekNumber} | FSHQ`,
    html: wrapInTemplate(content, `A stat correction has been applied to Week ${input.weekNumber}.`),
  });
}

export interface PowerRankingsPublishedEmailInput {
  to: string;
  userName: string;
  leagueName: string;
  leagueSlug: string;
  weekNumber: number;
}

export async function sendPowerRankingsPublishedEmail(input: PowerRankingsPublishedEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/leagues/${input.leagueSlug}/rankings`;
  
  const content = `
    <h1>📈 Power Rankings Published!</h1>
    <p>Hey ${input.userName},</p>
    <p>Week ${input.weekNumber} power rankings are now available for ${input.leagueName}!</p>
    <p>See where your team ranks and check out the commissioner's commentary.</p>
    <p style="text-align: center;">
      <a href="${link}" class="button">View Power Rankings</a>
    </p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `📈 Week ${input.weekNumber} Power Rankings Published | ${input.leagueName}`,
    html: wrapInTemplate(content, `Week ${input.weekNumber} power rankings are now available!`),
  });
}

export interface MatchupResultEmailInput {
  to: string;
  userName: string;
  leagueName: string;
  leagueSlug: string;
  weekNumber: number;
  won: boolean;
  opponentName: string;
  yourScore: number;
  opponentScore: number;
}

export async function sendMatchupResultEmail(input: MatchupResultEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/leagues/${input.leagueSlug}/matchups`;
  
  const title = input.won ? '🎉 Victory!' : '📊 Matchup Complete';
  const message = input.won
    ? `Congratulations! You defeated <strong>${input.opponentName}</strong>!`
    : `Your Week ${input.weekNumber} matchup against <strong>${input.opponentName}</strong> has ended.`;
  
  const content = `
    <h1>${title}</h1>
    <p>Hey ${input.userName},</p>
    <p>${message}</p>
    <div style="text-align: center; margin: 24px 0;">
      <div style="display: inline-block; padding: 16px 32px; background: ${input.won ? '#dcfce7' : '#f3f4f6'}; border-radius: 8px;">
        <span style="font-size: 32px; font-weight: bold; color: ${input.won ? '#16a34a' : '#1a1a1a'};">${input.yourScore.toFixed(1)}</span>
        <span style="color: #6b7280; margin: 0 8px;">-</span>
        <span style="font-size: 32px; font-weight: bold; color: #6b7280;">${input.opponentScore.toFixed(1)}</span>
      </div>
    </div>
    <p style="text-align: center;">
      <a href="${link}" class="button">View Full Results</a>
    </p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `${input.won ? '🎉' : '📊'} Week ${input.weekNumber} Result: ${input.yourScore.toFixed(1)} - ${input.opponentScore.toFixed(1)} | FSHQ`,
    html: wrapInTemplate(content, `Week ${input.weekNumber} matchup complete: ${input.yourScore.toFixed(1)} - ${input.opponentScore.toFixed(1)}`),
  });
}

export interface CommentReplyEmailInput {
  to: string;
  userName: string;
  leagueName: string;
  leagueSlug: string;
  momentId: string;
  replierName: string;
  replyPreview: string;
}

export async function sendCommentReplyEmail(input: CommentReplyEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/leagues/${input.leagueSlug}/moment/${input.momentId}`;
  
  const content = `
    <h1>💬 New Reply to Your Comment</h1>
    <p>Hey ${input.userName},</p>
    <p><strong>${input.replierName}</strong> replied to your comment in ${input.leagueName}:</p>
    <div class="highlight">
      <p style="margin: 0; font-style: italic;">"${input.replyPreview}"</p>
    </div>
    <p style="text-align: center;">
      <a href="${link}" class="button">View Conversation</a>
    </p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `💬 ${input.replierName} replied to your comment | FSHQ`,
    html: wrapInTemplate(content, `${input.replierName} replied to your comment.`),
  });
}

export interface MembershipApprovedEmailInput {
  to: string;
  userName: string;
  leagueName: string;
  leagueSlug: string;
}

export async function sendMembershipApprovedEmail(input: MembershipApprovedEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/leagues/${input.leagueSlug}/feed`;
  
  const content = `
    <h1>🎊 Welcome to ${input.leagueName}!</h1>
    <p>Hey ${input.userName},</p>
    <p>Great news! Your request to join <strong>${input.leagueName}</strong> has been approved.</p>
    <p>You now have full access to:</p>
    <ul>
      <li>📊 Power Rankings</li>
      <li>🎯 Pick'ems</li>
      <li>💬 League Feed</li>
      <li>📈 Leaderboards</li>
      <li>And much more!</li>
    </ul>
    <p style="text-align: center;">
      <a href="${link}" class="button">Enter the League</a>
    </p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `🎊 You're In! Welcome to ${input.leagueName} | FSHQ`,
    html: wrapInTemplate(content, `You've been approved to join ${input.leagueName}!`),
  });
}

export interface TeamClaimedEmailInput {
  to: string;
  userName: string;
  leagueName: string;
  leagueSlug: string;
  teamName: string;
}

export async function sendTeamClaimedEmail(input: TeamClaimedEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}/leagues/${input.leagueSlug}/teams`;
  
  const content = `
    <h1>🏆 Team Claimed Successfully!</h1>
    <p>Hey ${input.userName},</p>
    <p>You've successfully claimed <strong>${input.teamName}</strong> in ${input.leagueName}!</p>
    <p>As the team manager, you can:</p>
    <ul>
      <li>🎯 Make picks that count toward your team's record</li>
      <li>📊 See your team featured in power rankings</li>
      <li>🏆 Compete for the championship</li>
    </ul>
    <p style="text-align: center;">
      <a href="${link}" class="button">View Your Team</a>
    </p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `🏆 You claimed ${input.teamName}! | ${input.leagueName}`,
    html: wrapInTemplate(content, `You've claimed ${input.teamName} in ${input.leagueName}!`),
  });
}

export interface WeeklyDigestEmailInput {
  to: string;
  userName: string;
  leagues: Array<{
    name: string;
    slug: string;
    weekNumber: number;
    yourRecord: { wins: number; losses: number };
    leagueRank: number;
    totalMembers: number;
    highlights: string[];
  }>;
}

export async function sendWeeklyDigestEmail(input: WeeklyDigestEmailInput): Promise<EmailResult> {
  const baseUrl = getBaseUrl();
  
  const leagueBlocks = input.leagues.map(league => `
    <div style="margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
      <h2 style="font-size: 16px; margin: 0 0 16px 0;">${league.name}</h2>
      <div style="display: flex; gap: 16px; margin-bottom: 16px;">
        <div style="flex: 1; text-align: center; background: #f3f4f6; padding: 12px; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #2563eb;">${league.yourRecord.wins}-${league.yourRecord.losses}</div>
          <div style="font-size: 12px; color: #6b7280;">Week ${league.weekNumber} Record</div>
        </div>
        <div style="flex: 1; text-align: center; background: #f3f4f6; padding: 12px; border-radius: 8px;">
          <div style="font-size: 24px; font-weight: bold; color: #16a34a;">#${league.leagueRank}</div>
          <div style="font-size: 12px; color: #6b7280;">of ${league.totalMembers} members</div>
        </div>
      </div>
      ${league.highlights.length > 0 ? `
        <ul style="margin: 0; padding-left: 20px;">
          ${league.highlights.map(h => `<li style="color: #4b5563;">${h}</li>`).join('')}
        </ul>
      ` : ''}
      <p style="text-align: center; margin-top: 16px;">
        <a href="${baseUrl}/leagues/${league.slug}" style="color: #2563eb; text-decoration: none;">View League →</a>
      </p>
    </div>
  `).join('');
  
  const content = `
    <h1>📬 Your Weekly FSHQ Digest</h1>
    <p>Hey ${input.userName},</p>
    <p>Here's your weekly summary across all your leagues:</p>
    ${leagueBlocks}
    <p style="text-align: center;">
      <a href="${baseUrl}/dashboard" class="button">View All Leagues</a>
    </p>
  `;
  
  return sendEmail({
    to: input.to,
    subject: `📬 Your Weekly FSHQ Digest`,
    html: wrapInTemplate(content, `Your weekly fantasy football summary is here!`),
  });
}
