
import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  // Comprehensive SF Symbol to Material Icons mapping
  const iconMap: { [key: string]: keyof typeof MaterialIcons.glyphMap } = {
    // Communication & Messages
    'envelope': 'email',
    'envelope.fill': 'email',
    'mail': 'email',
    'mail_outline': 'email',
    'message': 'message',
    'message.fill': 'message',
    'chat': 'chat',
    'chat.fill': 'chat',
    
    // People & Social
    'person': 'person',
    'person.fill': 'person',
    'person.crop.circle': 'account-circle',
    'person.crop.circle.fill': 'account-circle',
    'person.2': 'group',
    'person.2.fill': 'people',
    'person.3.fill': 'group',
    'person.badge.plus': 'person-add',
    'person.badge.minus': 'person-remove',
    'person.crop.circle.badge.questionmark': 'person-search',
    'person.2.slash': 'people-outline',
    'person.crop.circle.badge.xmark': 'person-off',
    'group': 'group',
    'group.fill': 'group',
    'group-add': 'group-add',
    'group_add': 'group-add',
    'people': 'people',
    'people-outline': 'people-outline',
    
    // Navigation & UI
    'house': 'home',
    'house.fill': 'home',
    'chevron.right': 'chevron-right',
    'chevron.left': 'chevron-left',
    'chevron.down': 'expand-more',
    'chevron.up': 'expand-less',
    'arrow.clockwise': 'refresh',
    'arrow.up.circle.fill': 'send',
    'xmark.circle.fill': 'cancel',
    'xmark.circle': 'cancel',
    'plus.circle.fill': 'add-circle',
    'minus.circle.fill': 'remove-circle',
    'ellipsis': 'more-vert',
    
    // Status & Actions
    'checkmark': 'check',
    'checkmark.circle.fill': 'check-circle',
    'checkmark.shield.fill': 'verified-user',
    'exclamationmark.triangle.fill': 'warning',
    'info.circle.fill': 'info',
    'questionmark.circle.fill': 'help-outline',
    'questionmark': 'help-outline',
    
    // Location & Maps
    'location.fill': 'location-on',
    'map.fill': 'map',
    'map.circle.fill': 'map',
    
    // Notifications & Alerts
    'bell.fill': 'notifications',
    'bell.slash.fill': 'notifications-off',
    'bell': 'notifications',
    
    // Settings & Tools
    'gearshape.fill': 'settings',
    'gearshape': 'settings',
    'slider.horizontal.2': 'tune',
    'line.3.horizontal.decrease.circle': 'tune',
    'filter': 'tune',
    'filter-list': 'filter-list',
    
    // Security & Privacy
    'lock.shield.fill': 'lock',
    'lock.fill': 'lock',
    'lock': 'lock',
    
    // Time & Schedule
    'clock.fill': 'schedule',
    'clock': 'schedule',
    
    // Search & Discovery
    'magnifyingglass': 'search',
    
    // Media & Content
    'camera.fill': 'photo-camera',
    'photo.fill': 'photo',
    'image': 'image',
    
    // Documents & Files
    'doc.text.fill': 'description',
    'pencil': 'edit',
    
    // Actions & Controls
    'trash.fill': 'delete',
    'trash': 'delete',
    'rectangle.portrait.and.arrow.right': 'exit-to-app',
    'logout': 'exit-to-app',
    
    // Charts & Data
    'chart.bar.fill': 'bar-chart',
    'chart.line.uptrend.xyaxis': 'trending-up',
    
    // Common fallbacks for unmapped icons
    'help': 'help-outline',
    'info': 'info',
    'error': 'error',
    'warning': 'warning',
    'add': 'add',
    'remove': 'remove',
    'close': 'close',
    'menu': 'menu',
    'home': 'home',
  };

  // Determine which icon name to use
  // Priority: android_material_icon_name > mapped ios_icon_name > ios_icon_name > fallback
  let finalIconName: string;
  
  if (android_material_icon_name) {
    finalIconName = android_material_icon_name;
  } else if (ios_icon_name && iconMap[ios_icon_name]) {
    finalIconName = iconMap[ios_icon_name];
  } else if (ios_icon_name) {
    finalIconName = ios_icon_name;
  } else {
    finalIconName = 'home';
  }
  
  // Verify the icon exists in MaterialIcons.glyphMap
  const validIconName = MaterialIcons.glyphMap[finalIconName as keyof typeof MaterialIcons.glyphMap] !== undefined 
    ? (finalIconName as keyof typeof MaterialIcons.glyphMap)
    : 'help-outline'; // Fallback to help icon if invalid

  // Log warning for invalid icons in development
  if (validIconName === 'help-outline' && finalIconName !== 'help-outline') {
    console.warn(`[IconSymbol] Invalid Material icon name: "${finalIconName}". Using fallback "help-outline". Original props: ios="${ios_icon_name}", android="${android_material_icon_name}"`);
  }

  return (
    <MaterialIcons
      name={validIconName}
      size={size}
      color={color}
    />
  );
}
