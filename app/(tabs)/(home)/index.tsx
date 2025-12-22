
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { useCourts } from '@/hooks/useCourts';
import { IconSymbol } from '@/components/IconSymbol';

export default function HomeScreen() {
  const router = useRouter();
  const { courts, loading, refetch } = useCourts();

  // Heat map gradient: green → yellow → orange
  const getActivityColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return colors.orange; // Orange for high activity
      case 'medium':
        return colors.accent; // Yellow for medium activity
      case 'low':
        return colors.success; // Green for low activity
    }
  };

  const getActivityLabel = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return 'High Activity';
      case 'medium':
        return 'Medium Activity';
      case 'low':
        return 'Low Activity';
    }
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image 
            source={require('@/assets/images/d00ee021-be7a-42f9-a115-ea45cb937f7f.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[commonStyles.textSecondary, { textAlign: 'center', marginTop: 12 }]}>
            Find active pickleball courts near you
          </Text>
        </View>

        <View style={styles.mapPlaceholder}>
          <IconSymbol 
            ios_icon_name="map.fill" 
            android_material_icon_name="map" 
            size={48} 
            color={colors.textSecondary} 
          />
          <Text style={[commonStyles.text, { textAlign: 'center', marginTop: 16 }]}>
            Map view is not currently supported in Natively.
          </Text>
          <Text style={[commonStyles.textSecondary, { textAlign: 'center', marginTop: 8 }]}>
            Browse courts below to see activity levels and check in.
          </Text>
          
          <View style={styles.heatMapLegend}>
            <Text style={[commonStyles.textSecondary, { marginBottom: 8, fontWeight: '600' }]}>
              Activity Heat Map:
            </Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={styles.legendText}>Low</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.legendText}>Medium</Text>
              <View style={[styles.legendDot, { backgroundColor: colors.orange }]} />
              <Text style={styles.legendText}>High</Text>
            </View>
          </View>
        </View>

        <View style={styles.courtsSection}>
          <View style={styles.sectionHeader}>
            <Text style={commonStyles.subtitle}>Nearby Courts</Text>
            <TouchableOpacity onPress={refetch}>
              <IconSymbol 
                ios_icon_name="arrow.clockwise" 
                android_material_icon_name="refresh" 
                size={24} 
                color={colors.primary} 
              />
            </TouchableOpacity>
          </View>

          {courts.length === 0 ? (
            <View style={commonStyles.card}>
              <Text style={[commonStyles.text, { textAlign: 'center' }]}>
                No courts found. Check back later!
              </Text>
            </View>
          ) : (
            courts.map((court, index) => (
              <TouchableOpacity
                key={index}
                style={commonStyles.card}
                onPress={() => router.push(`/(tabs)/(home)/court/${court.id}`)}
              >
                <View style={styles.courtHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.courtName}>{court.name}</Text>
                    <Text style={commonStyles.textSecondary}>{court.address}</Text>
                  </View>
                  <View style={[styles.activityBadge, { backgroundColor: getActivityColor(court.activityLevel) }]}>
                    <Text style={styles.activityText}>{getActivityLabel(court.activityLevel)}</Text>
                  </View>
                </View>
                
                <View style={styles.courtFooter}>
                  <View style={styles.playerCount}>
                    <IconSymbol 
                      ios_icon_name="person.2.fill" 
                      android_material_icon_name="people" 
                      size={16} 
                      color={colors.textSecondary} 
                    />
                    <Text style={[commonStyles.textSecondary, { marginLeft: 6 }]}>
                      {court.currentPlayers} {court.currentPlayers === 1 ? 'player' : 'players'}
                    </Text>
                  </View>
                  <IconSymbol 
                    ios_icon_name="chevron.right" 
                    android_material_icon_name="chevron_right" 
                    size={20} 
                    color={colors.textSecondary} 
                  />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  mapPlaceholder: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  heatMapLegend: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginRight: 12,
  },
  courtsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  courtName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  activityBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.card,
  },
  courtFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playerCount: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
