
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface SkillLevelBarsProps {
  averageSkillLevel: number; // 0-3 representing average skill (0 = no players, 1 = Beginner, 2 = Intermediate, 3 = Advanced)
  size?: number;
  color?: string;
}

export const SkillLevelBars: React.FC<SkillLevelBarsProps> = ({ 
  averageSkillLevel, 
  size = 16,
  color = colors.primary 
}) => {
  // Convert 0-3 scale to 0-4 bars for display
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
});
