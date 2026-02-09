
import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

export function useFavorites(userId: string | undefined) {
  const [favoriteCourtIds, setFavoriteCourtIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Fetch user's favorite court IDs (batched in one query)
  const fetchFavorites = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    console.log('useFavorites: Fetching favorites for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('court_favorites')
        .select('court_id')
        .eq('user_id', userId);

      if (error) {
        console.error('useFavorites: Error fetching favorites:', error);
        setLoading(false);
        return;
      }

      const courtIds = new Set((data || []).map(fav => fav.court_id));
      console.log('useFavorites: Loaded', courtIds.size, 'favorites');
      setFavoriteCourtIds(courtIds);
      setLoading(false);
    } catch (error) {
      console.error('useFavorites: Error in fetchFavorites:', error);
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Toggle favorite (optimistic UI)
  const toggleFavorite = useCallback(async (courtId: string) => {
    if (!userId || !isSupabaseConfigured()) {
      console.log('useFavorites: Cannot toggle favorite - no user or Supabase not configured');
      return;
    }

    const isFavorited = favoriteCourtIds.has(courtId);
    console.log('useFavorites: Toggling favorite for court:', courtId, 'Currently favorited:', isFavorited);

    // OPTIMISTIC UI: Update state immediately
    setFavoriteCourtIds(prev => {
      const newSet = new Set(prev);
      if (isFavorited) {
        newSet.delete(courtId);
      } else {
        newSet.add(courtId);
      }
      return newSet;
    });

    try {
      if (isFavorited) {
        // Remove favorite
        const { error } = await supabase
          .from('court_favorites')
          .delete()
          .eq('user_id', userId)
          .eq('court_id', courtId);

        if (error) {
          console.error('useFavorites: Error removing favorite:', error);
          // Revert optimistic update on error
          setFavoriteCourtIds(prev => {
            const newSet = new Set(prev);
            newSet.add(courtId);
            return newSet;
          });
        } else {
          console.log('useFavorites: Successfully removed favorite');
          // Invalidate courts query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['courts'] });
        }
      } else {
        // Add favorite
        const { error } = await supabase
          .from('court_favorites')
          .insert({
            user_id: userId,
            court_id: courtId,
          });

        if (error) {
          console.error('useFavorites: Error adding favorite:', error);
          // Revert optimistic update on error
          setFavoriteCourtIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(courtId);
            return newSet;
          });
        } else {
          console.log('useFavorites: Successfully added favorite');
          // Invalidate courts query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['courts'] });
        }
      }
    } catch (error) {
      console.error('useFavorites: Error in toggleFavorite:', error);
      // Revert optimistic update on error
      setFavoriteCourtIds(prev => {
        const newSet = new Set(prev);
        if (isFavorited) {
          newSet.add(courtId);
        } else {
          newSet.delete(courtId);
        }
        return newSet;
      });
    }
  }, [userId, favoriteCourtIds, queryClient]);

  const isFavorite = useCallback((courtId: string) => {
    return favoriteCourtIds.has(courtId);
  }, [favoriteCourtIds]);

  return {
    favoriteCourtIds,
    loading,
    toggleFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
}
