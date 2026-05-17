/**
 * AppNavigator - Bottom Tab Navigator
 * 4 tab: Ana Sayfa, İşlemler, Tarama, Profil
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import ScanScreen from '../screens/ScanScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  AnaSayfa: '🏠',
  Islemler: '📋',
  Tarama: '📸',
  Profil: '👤',
};

const TabIcon = React.memo(({ routeName, focused }) => {
  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.tabIcon, focused && styles.tabIconActive]}>
        {TAB_ICONS[routeName]}
      </Text>
      {focused && <View style={styles.activeDot} />}
    </View>
  );
});

TabIcon.displayName = 'TabIcon';

const AppNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => (
          <TabIcon routeName={route.name} focused={focused} />
        ),
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.secondary,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen
        name="AnaSayfa"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Ana Sayfa' }}
      />
      <Tab.Screen
        name="Islemler"
        component={TransactionsScreen}
        options={{ tabBarLabel: 'İşlemler' }}
      />
      <Tab.Screen
        name="Tarama"
        component={ScanScreen}
        options={{ tabBarLabel: 'Tarama' }}
      />
      <Tab.Screen
        name="Profil"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Profil' }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    height: 64,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.outlineVariant,
    paddingBottom: 8,
    paddingTop: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
  },
  tabLabel: {
    ...Typography.labelMd,
    marginTop: -2,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.6,
  },
  tabIconActive: {
    opacity: 1,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 2,
  },
});

export default AppNavigator;
