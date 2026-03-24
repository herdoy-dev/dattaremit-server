import { Expo } from "expo-server-sdk";

const expoClient = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN,
});

export default expoClient;
