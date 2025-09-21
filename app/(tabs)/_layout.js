import { Tabs } from 'expo-router';
import { Chrome as Home, MapPin, Users, Trophy, MessageSquare, Phone, MessageCircle, Hammer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { getCurrentUser, getUserProfile } from '../../lib/supabase';

export default function TabLayout() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const { user: currentUser } = await getCurrentUser();
      if (currentUser) {
        const { data: profile } = await getUserProfile(currentUser.id);
        setUser(profile);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };
  
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1E40AF',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 5,
          height: 65,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('navigation.home'),
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: t('navigation.report'),
          tabBarIcon: ({ size, color }) => (
            <MapPin size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="heatmap"
        options={{
          title: t('navigation.heatmap'),
          tabBarIcon: ({ size, color }) => (
            <MapPin size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('navigation.leaderboard'),
          tabBarIcon: ({ size, color }) => (
            <Trophy size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: t('navigation.community'),
          tabBarIcon: ({ size, color }) => (
            <MessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="contact"
        options={{
          title: 'Contact',
          tabBarIcon: ({ size, color }) => (
            <Phone size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: 'Feedback',
          tabBarIcon: ({ size, color }) => (
            <MessageCircle size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="work"
        options={{
          title: 'My Work',
          tabBarIcon: ({ size, color }) => (
            <Hammer size={size} color={color} />
          ),
          href: user?.user_type === 'tender' ? '/contractor-work' : null,
        }}
      />
    </Tabs>
  );
}