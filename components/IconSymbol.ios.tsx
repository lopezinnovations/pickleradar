
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
  // Map common icon names to iOS SF Symbols
  const iconMap: { [key: string]: string } = {
    'mail': 'envelope.fill',
    'mail_outline': 'envelope',
    'email': 'envelope.fill',
    'message': 'message.fill',
    'people': 'person.2.fill',
    'person': 'person.fill',
    'account-circle': 'person.crop.circle.fill',
    'location-on': 'location.fill',
    'check-circle': 'checkmark.circle.fill',
    'check': 'checkmark',
    'chevron-right': 'chevron.right',
    'chevron-left': 'chevron.left',
    'expand-more': 'chevron.down',
    'expand-less': 'chevron.up',
    'refresh': 'arrow.clockwise',
    'notifications': 'bell.fill',
    'lock': 'lock.shield.fill',
    'warning': 'exclamationmark.triangle.fill',
    'phone': 'phone.fill',
    'settings': 'gearshape.fill',
    'delete': 'trash.fill',
    'logout': 'rectangle.portrait.and.arrow.right',
    'verified-user': 'checkmark.shield.fill',
    'info': 'info.circle.fill',
    'schedule': 'clock.fill',
    'cancel': 'xmark.circle.fill',
    'bar-chart': 'chart.bar.fill',
    'filter-list': 'line.3.horizontal.decrease.circle',
    'tune': 'slider.horizontal.2',
    'search': 'magnifyingglass',
    'add-circle': 'plus.circle.fill',
    'remove-circle': 'minus.circle.fill',
    'photo-camera': 'camera.fill',
    'map': 'map.fill',
    'person-remove': 'person.badge.minus',
    'person-add': 'person.badge.plus',
    'help': 'person.crop.circle.badge.questionmark',
    'description': 'doc.text.fill',
    'edit': 'pencil',
    'home': 'house.fill',
  };

  let iconName = ios_icon_name || android_material_icon_name || 'house';
  
  // Check if we need to map the icon name
  if (iconMap[iconName]) {
    iconName = iconMap[iconName];
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
