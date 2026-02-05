/**
 * Calculate user level from total XP (0-indexed levels)
 * Level 0 = 0 XP, Level 1 = 200 XP, Level 2 = 400 XP, etc.
 */
export function calculateLevelFromXp(totalXp) {
  const XP_PER_LEVEL_1_6 = 200;
  const XP_PER_LEVEL_7_PLUS = 300;
  
  // Level 0-6 (200 XP each)
  if (totalXp < 6 * XP_PER_LEVEL_1_6) {  // Less than 1200 XP
    return Math.floor(totalXp / XP_PER_LEVEL_1_6);
  }
  
  // Level 7+ (300 XP each after level 6)
  const xpAfterLevel6 = totalXp - (6 * XP_PER_LEVEL_1_6);
  const levelsAfter6 = Math.floor(xpAfterLevel6 / XP_PER_LEVEL_7_PLUS);
  return 6 + levelsAfter6;
}

/**
 * Calculate badge ID from level
 * Level 0 = no badge, Level 1-9 = badge 1-9, Level 10+ = badge 10
 */
export function calculateBadgeIdFromLevel(level) {
  if (level === 0) {
    return null;
  }
  if (level >= 10) {
    return 10;  // Max badge
  }
  return level;  // 1:1 mapping for levels 1-9
}