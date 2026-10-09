import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#0a0a1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="create"
          options={{
            title: '创建记录',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="detail/[id]"
          options={{
            title: '记忆详情',
          }}
        />
      </Stack>
    </>
  );
}
