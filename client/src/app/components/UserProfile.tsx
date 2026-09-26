import { User } from "lucide-react";
import React from "react";

type UserProfileProps = {
  username: string;
  totalXp: number;        // Total lifetime XP from backend
  level: number;          // Current level from backend (0-indexed)
  badgeIcon?: React.ReactElement;
  badgeColor?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export default function UserProfile({
  username,
  totalXp,
  level,
  badgeIcon,
  badgeColor,
}: UserProfileProps) {
  // XP CALCULATION - 200 XP for levels 0-6, 300 XP for level 7+
  const XP_PER_LEVEL_1_6 = 200;
  const XP_PER_LEVEL_7_PLUS = 300;

  // Calculate total XP required to reach current level
  // Level 0 = 0 XP, Level 1 = 200 XP, Level 2 = 400 XP, Level 7 = 1500 XP
  const xpRequiredForCurrentLevel = level <= 6 
    ? level * XP_PER_LEVEL_1_6  // levels 0-6: level * 200
    : (6 * XP_PER_LEVEL_1_6) + ((level - 6) * XP_PER_LEVEL_7_PLUS); // level 7+: 1200 + (level-6) * 300

  // XP progress within current level (toward next level)
  const xpInCurrentLevel = totalXp - xpRequiredForCurrentLevel;

  // XP required for next level
  const xpRequiredForNextLevel = (level + 1) <= 6 ? XP_PER_LEVEL_1_6 : XP_PER_LEVEL_7_PLUS;

  // Progress percentage
  const safeMaxXp = Math.max(0, xpRequiredForNextLevel);
  const safeXp = clamp(xpInCurrentLevel, 0, safeMaxXp);
  const progressPercentage = safeMaxXp === 0 ? 0 : (safeXp / safeMaxXp) * 100;

  return (
    <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-2 border border-gray-200 shadow-sm">
      {/* Profile Picture with Badge */}
      <div className="relative">
        {badgeIcon && badgeColor ? (
          <div
            className={`size-10 rounded-full bg-gradient-to-br ${badgeColor} flex items-center justify-center text-white border-2 border-white shadow-md`}
          >
            {React.cloneElement(badgeIcon)}
          </div>
        ) : (
          <div className="size-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 border-2 border-white shadow-md">
            <User className="size-6" />
          </div>
        )}

        {/* Level Badge */}
        <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-white text-xs font-bold rounded-full size-5 flex items-center justify-center border-2 border-white">
          {level}
        </div>
      </div>

      {/* User Info */}
      <div className="hidden sm:block">
        <div className="text-sm font-semibold text-gray-900">{username}</div>

        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <span className="text-xs text-gray-600">
            {safeXp}/{safeMaxXp}
          </span>
        </div>
      </div>
    </div>
  );
}