import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { UpdateModal } from '@/components/update-modal';
import { useAppUpdate } from '@/hooks/use-app-update';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { LoginScreen } from '@/screens/login-screen';
import { SetPasswordScreen } from '@/screens/set-password-screen';

SplashScreen.preventAutoHideAsync();

function RootContent() {
  const { user, isBootstrapping } = useAuth();
  const { nativeUpdate, dismiss } = useAppUpdate();

  if (isBootstrapping) return null; // AnimatedSplashOverlay masih menutupi layar di fase ini

  if (user?.mustSetPassword) return <SetPasswordScreen />;

  return (
    <>
      {nativeUpdate && <UpdateModal info={nativeUpdate} onDismiss={dismiss} />}
      {user ? <AppTabs /> : <LoginScreen />}
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AuthProvider>
          <RootContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
