
import React from 'react';
import { SymbolView } from 'expo-symbols';
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
  // Comprehensive Material Icons to SF Symbols mapping
  const iconMap: { [key: string]: string } = {
    // Communication & Messages
    'mail': 'envelope.fill',
    'mail_outline': 'envelope',
    'email': 'envelope.fill',
    'message': 'message.fill',
    'chat': 'message.fill',
    'send': 'arrow.up.circle.fill',
    
    // People & Social
    'people': 'person.2.fill',
    'person': 'person.fill',
    'account-circle': 'person.crop.circle.fill',
    'location-on': 'location.fill',
    'group': 'person.3.fill',
    'group-add': 'person.3.fill',
    'person-add': 'person.badge.plus',
    'person-remove': 'person.badge.minus',
    'person-search': 'person.crop.circle.badge.questionmark',
    'person-off': 'person.crop.circle.badge.xmark',
    'people-outline': 'person.2.slash',
    
    // Status & Actions
    'check-circle': 'checkmark.circle.fill',
    'check': 'checkmark',
    'verified-user': 'checkmark.shield.fill',
    'warning': 'exclamationmark.triangle.fill',
    'error': 'exclamationmark.triangle.fill',
    'info': 'info.circle.fill',
    'info-outline': 'info.circle',
    'help-outline': 'questionmark.circle',
    'help': 'questionmark.circle.fill',
    
    // Navigation & UI
    'chevron-right': 'chevron.right',
    'chevron-left': 'chevron.left',
    'expand-more': 'chevron.down',
    'expand-less': 'chevron.up',
    'refresh': 'arrow.clockwise',
    'cancel': 'xmark.circle.fill',
    'close': 'xmark.circle',
    'add-circle': 'plus.circle.fill',
    'remove-circle': 'minus.circle.fill',
    'add': 'plus',
    'remove': 'minus',
    'more-vert': 'ellipsis',
    'more-horiz': 'ellipsis',
    'home': 'house.fill',
    
    // Notifications & Alerts
    'notifications': 'bell.fill',
    'notifications-off': 'bell.slash.fill',
    
    // Settings & Tools
    'settings': 'gearshape.fill',
    'tune': 'slider.horizontal.2',
    'filter-list': 'line.3.horizontal.decrease.circle',
    
    // Security & Privacy
    'lock': 'lock.shield.fill',
    'lock-open': 'lock.open',
    
    // Time & Schedule
    'schedule': 'clock.fill',
    'access-time': 'clock',
    
    // Search & Discovery
    'search': 'magnifyingglass',
    
    // Media & Content
    'photo-camera': 'camera.fill',
    'camera': 'camera.fill',
    'photo': 'photo.fill',
    'image': 'photo',
    
    // Location & Maps
    'map': 'map.fill',
    
    // Documents & Files
    'description': 'doc.text.fill',
    'edit': 'pencil',
    
    // Actions & Controls
    'delete': 'trash.fill',
    'exit-to-app': 'rectangle.portrait.and.arrow.right',
    'logout': 'rectangle.portrait.and.arrow.right',
    
    // Charts & Data
    'bar-chart': 'chart.bar.fill',
    'trending-up': 'chart.line.uptrend.xyaxis',
  };

  // Determine which icon name to use
  // Priority: ios_icon_name > mapped android_material_icon_name > android_material_icon_name > fallback
  let iconName: string;
  
  if (ios_icon_name) {
    iconName = ios_icon_name;
  } else if (android_material_icon_name && iconMap[android_material_icon_name]) {
    iconName = iconMap[android_material_icon_name];
  } else if (android_material_icon_name) {
    // Try to use the Material icon name directly if no mapping exists
    iconName = android_material_icon_name;
  } else {
    iconName = 'house.fill';
  }

  return (
    <SymbolView
      name={iconName}
      size={size}
      tintColor={color}
      type="monochrome"
      weight="regular"
    />
  );
}
