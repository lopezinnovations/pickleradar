
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
  // Use Material Icons for Android/Web
  const iconName = (android_material_icon_name || ios_icon_name || 'home') as keyof typeof MaterialIcons.glyphMap;
  
  // Map iOS SF Symbol names to Material Icons names
  const iconMap: { [key: string]: keyof typeof MaterialIcons.glyphMap } = {
    'envelope': 'email',
    'envelope.fill': 'email',
    'mail': 'email',
    'mail_outline': 'email',
    'message.fill': 'message',
    'house': 'home',
    'person.fill': 'person',
    'person.crop.circle': 'account-circle',
    'person.crop.circle.fill': 'account-circle',
    'person.2.fill': 'people',
    'location.fill': 'location-on',
    'checkmark.circle.fill': 'check-circle',
    'checkmark': 'check',
    'chevron.right': 'chevron-right',
    'chevron.left': 'chevron-left',
    'chevron.down': 'expand-more',
    'chevron.up': 'expand-less',
    'arrow.clockwise': 'refresh',
    'bell.fill': 'notifications',
    'lock.shield.fill': 'lock',
    'exclamationmark.triangle.fill': 'warning',
    'phone.fill': 'phone',
    'gearshape.fill': 'settings',
    'gearshape': 'settings',
    'trash.fill': 'delete',
    'trash': 'delete',
    'rectangle.portrait.and.arrow.right': 'logout',
    'checkmark.shield.fill': 'verified-user',
    'info.circle.fill': 'info',
    'clock.fill': 'schedule',
    'xmark.circle.fill': 'cancel',
    'xmark.circle': 'cancel',
    'chart.bar.fill': 'bar-chart',
    'line.3.horizontal.decrease.circle': 'filter-list',
    'slider.horizontal.2': 'tune',
    'magnifyingglass': 'search',
    'plus.circle.fill': 'add-circle',
    'minus.circle.fill': 'remove-circle',
    'camera.fill': 'photo-camera',
    'map.fill': 'map',
    'map.circle.fill': 'map',
    'person.badge.minus': 'person-remove',
    'person.badge.plus': 'person-add',
    'person.crop.circle.badge.questionmark': 'help',
    'doc.text.fill': 'description',
    'pencil': 'edit',
  };

  // Check if we need to map the icon name
  const mappedIconName = iconMap[iconName] || iconName;
  
  // Verify the icon exists in MaterialIcons.glyphMap
  const validIconName = MaterialIcons.glyphMap[mappedIconName] !== undefined 
    ? mappedIconName 
    : 'help-outline'; // Fallback to help icon if invalid

  return (
    <MaterialIcons
      name={validIconName}
      size={size}
      color={color}
    />
  );
}
