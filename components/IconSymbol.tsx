
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';

interface IconSymbolProps {
  ios_icon_name?: string;
  android_material_icon_name?: string;
  size?: number;
  color?: string;
}

export function IconSymbol({ 
  ios_icon_name, 
  android_material_icon_name, 
  size = 24, 
  color = colors.text 
}: IconSymbolProps) {
  const iconMap: { [key: string]: string } = {
    'home': '🏠',
    'map': '📍',
    'map.fill': '📍',
    'map-pin': '📍',
    'map.circle.fill': '🗺️',
    'people': '👥',
    'person': '👤',
    'person.fill': '👤',
    'person.2.fill': '👥',
    'person.2.slash': '🚫',
    'person.crop.circle': '👤',
    'person.crop.circle.fill': '👤',
    'location.fill': '📍',
    'location_on': '📍',
    'checkmark.circle.fill': '✅',
    'check_circle': '✅',
    'chevron.right': '›',
    'chevron.left': '‹',
    'chevron_right': '›',
    'chevron_left': '‹',
    'arrow.clockwise': '🔄',
    'refresh': '🔄',
    'bell.fill': '🔔',
    'notifications': '🔔',
    'lock.shield.fill': '🔒',
    'shield': '🔒',
    'exclamationmark.triangle.fill': '⚠️',
    'warning': '⚠️',
    'phone.fill': '📞',
    'phone': '📞',
    'people_outline': '👥',
    'settings': '⚙️',
    'gear': '⚙️',
    'trash': '🗑️',
    'delete': '🗑️',
    'account_circle': '👤',
    'info.circle.fill': 'ℹ️',
    'info': 'ℹ️',
  };

  const iconName = ios_icon_name || android_material_icon_name || 'home';
  const icon = iconMap[iconName] || '•';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Text style={[styles.icon, { fontSize: size * 0.8, color }]}>
        {icon}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    textAlign: 'center',
  },
});
