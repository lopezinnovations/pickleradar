
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface SkillLevelBarsProps {
  averageSkillLevel: number; // 0-3 representing average skill (0 = no players, 1 = Beginner, 2 = Intermediate, 3 = Advanced)
  size?: number;
  color?: string;
  skillLevel?: 'Beginner' | 'Intermediate' | 'Advanced'; // For profile display
}

export const SkillLevelBars: React.FC<SkillLevelBarsProps> = ({ 
  averageSkillLevel, 
  size = 16,
  color = colors.primary,
  skillLevel
}) => {
  // If skillLevel is provided (for profile), use that for width calculation
  let fillPercentage = 0;
  
  if (skillLevel) {
    // Beginner: 33%, Intermediate: 66%, Advanced: 100%
    switch (skillLevel) {
      case 'Beginner':
        fillPercentage = 0.33;
        break;
      case 'Intermediate':
        fillPercentage = 0.66;
        break;
      case 'Advanced':
        fillPercentage = 1.0;
        break;
    }
    
    return (
      <View style={[styles.progressContainer, { height: size }]}>
        <View 
          style={[
            styles.progressBar, 
            { 
              width: `${fillPercentage * 100}%`,
              backgroundColor: color,
              height: size,
            }
          ]} 
        />
      </View>
    );
  }
  
  // Otherwise, use the bar display for court average skill level
  const normalizedLevel = Math.min(Math.max(averageSkillLevel, 0), 3);
  const barCount = Math.round((normalizedLevel / 3) * 4);
  const bars = [1, 2, 3, 4];

  return (
    <View style={styles.container}>
      {bars.map((bar, index) => {
        const isActive = bar <= barCount;
        const barHeight = (bar / 4) * size;
        
        return (
          <View
            key={index}
            style={[
              styles.bar,
              {
                width: size / 5,
                height: barHeight,
                backgroundColor: isActive ? color : colors.border,
                marginLeft: index > 0 ? 2 : 0,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 16,
  },
  bar: {
    borderRadius: 1,
  },
  progressContainer: {
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBar: {
    borderRadius: 8,
  },
});

// ============================================
// SKELETON LOADER COMPONENTS
// ============================================

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Court Card Skeleton
export function CourtCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.header}>
        <View style={{ flex: 1 }}>
          <Skeleton width="70%" height={18} style={{ marginBottom: 8 }} />
          <Skeleton width="90%" height={14} style={{ marginBottom: 4 }} />
          <Skeleton width="40%" height={14} />
        </View>
        <View style={skeletonStyles.actions}>
          <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 8 }} />
          <Skeleton width={40} height={40} borderRadius={20} />
        </View>
      </View>
      <View style={skeletonStyles.footer}>
        <Skeleton width="30%" height={14} />
        <Skeleton width="25%" height={14} />
        <Skeleton width="20%" height={14} />
      </View>
    </View>
  );
}

// Friend Card Skeleton
export function FriendCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.friendHeader}>
        <Skeleton width={48} height={48} borderRadius={24} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} />
          <Skeleton width="80%" height={14} style={{ marginBottom: 4 }} />
          <Skeleton width="50%" height={12} />
        </View>
        <Skeleton width={32} height={32} borderRadius={16} />
      </View>
    </View>
  );
}

// Conversation Card Skeleton
export function ConversationCardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.conversationHeader}>
        <Skeleton width={56} height={56} borderRadius={28} style={{ marginRight: 12 }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Skeleton width="50%" height={16} />
            <Skeleton width="20%" height={12} />
          </View>
          <Skeleton width="90%" height={14} />
        </View>
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
