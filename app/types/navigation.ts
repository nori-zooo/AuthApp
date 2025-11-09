import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
};

export type AppsListStackParamList = {
  AppsList: undefined;
  MapScreen: undefined;
  PartsSampleScreen: undefined;
  ImageUploadScreen: undefined;
  MusicUploadScreen: undefined;
  GraphSampleScreen: undefined;
  VictorySampleScreen: undefined;
};

export type RootTabParamList = {
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
  AppsListStack: NavigatorScreenParams<AppsListStackParamList> | undefined;
};