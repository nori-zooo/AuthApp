// Load local environment variables when running locally
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch (e) {
  // ignore if dotenv is not installed in production
}

export default {
  expo: {
    name: "AuthApp",
    slug: "auth-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],
    ios: { supportsTablet: true },
    plugins: [
      [
        "expo-audio",
        {
          microphonePermission: "AuthApp がマイクにアクセスすることを許可しますか？",
        },
      ],
    ],
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      }
    },
    web: { favicon: "./assets/favicon.png" },
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      // Storage bucket name can be configured via env, defaults to 'images'
      supabaseBucket: process.env.EXPO_PUBLIC_SUPABASE_BUCKET ?? 'images',
      supabaseImageBucket: process.env.EXPO_PUBLIC_SUPABASE_IMAGE_BUCKET ?? 'images',
      supabaseAudioBucket: process.env.EXPO_PUBLIC_SUPABASE_AUDIO_BUCKET ?? 'audio'
    }
  }
};