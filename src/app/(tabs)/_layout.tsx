import AppTabs from '@/components/app-tabs';

/**
 * La doc Expo ne documente que <NativeTabs.Trigger> et <NativeTabs.BottomAccessory>
 * comme enfants de <NativeTabs> : on garde donc ce layout minimal. Le mini-lecteur,
 * qui doit de toute façon survivre à la navigation, est monté dans app/_layout.tsx.
 */
export default function TabsLayout() {
  return <AppTabs />;
}
