import React from 'react';
import { Badge, Star, Zap, Trophy, Flame, Crown, Target, Award, Sparkles, Shield } from 'lucide-react';

export type BadgeItem = {
  id: string;
  name: string;
  icon: React.ReactElement;
  color: string;
  level: number;
};

// Each badge represents a new level. When XP bar fills, user unlocks the badge and it becomes their profile picture
export const BADGE_LIST: BadgeItem[] = [
  {
    id: 'bronze-star',
    name: 'Bronze Star',
    icon: <Star className="size-12" />,
    color: 'from-orange-400 to-orange-600',
    level: 1,
  },
  {
    id: 'silver-shield',
    name: 'Silver Shield',
    icon: <Shield className="size-12" />,
    color: 'from-gray-300 to-gray-500',
    level: 2,
  },
  {
    id: 'gold-trophy',
    name: 'Gold Trophy',
    icon: <Trophy className="size-12" />,
    color: 'from-yellow-400 to-yellow-600',
    level: 3,
  },
  {
    id: 'platinum-crown',
    name: 'Platinum Crown',
    icon: <Crown className="size-12" />,
    color: 'from-cyan-400 to-cyan-600',
    level: 4,
  },
  {
    id: 'diamond-flame',
    name: 'Diamond Flame',
    icon: <Flame className="size-12" />,
    color: 'from-blue-400 to-purple-600',
    level: 5,
  },
  {
    id: 'master-sparkles',
    name: 'Master Sparkles',
    icon: <Sparkles className="size-12" />,
    color: 'from-pink-400 to-purple-600',
    level: 6,
  },
  {
    id: 'legend-zap',
    name: 'Legend Zap',
    icon: <Zap className="size-12" />,
    color: 'from-yellow-300 to-red-600',
    level: 7,
  },
  {
    id: 'ultimate-target',
    name: 'Ultimate Target',
    icon: <Target className="size-12" />,
    color: 'from-red-500 to-pink-700',
    level: 8,
  },
  {
    id: 'grand-award',
    name: 'Grand Award',
    icon: <Award className="size-12" />,
    color: 'from-indigo-400 to-purple-700',
    level: 9,
  },
  {
    id: 'supreme-badge',
    name: 'Supreme Badge',
    icon: <Badge className="size-12" />,
    color: 'from-purple-500 to-pink-600',
    level: 10,
  },
];
