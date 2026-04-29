import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  Easing,
  FadeIn
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

const LoadingScreen = () => {
  const pulse = useSharedValue(1);
  const rotation = useSharedValue(0);

  const progress = useSharedValue(-width * 0.6);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    rotation.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    );

    progress.value = withRepeat(
      withTiming(width * 0.6, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
  }, []);

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulse.value },
      { rotate: `${rotation.value}deg` }
    ],
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const animatedProgressStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value }],
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#4f46e5', '#818cf8', '#6366f1']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <Animated.View entering={FadeIn.duration(1000)} style={styles.content}>
        <View style={styles.logoContainer}>
          <Animated.View style={[styles.logoOutline, animatedLogoStyle]} />
          <Image 
            source={require('../assets/images/splash_icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>Timeliney</Text>
          <Animated.Text style={[styles.subtitle, animatedTextStyle]}>
            Capturing your journey...
          </Animated.Text>
        </View>

        <View style={styles.loaderContainer}>
          <View style={styles.loaderBarBase}>
            <Animated.View style={[styles.loaderBarProgress, animatedProgressStyle]} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#4f46e5',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoOutline: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderStyle: 'dashed',
  },
  logo: {
    width: 100,
    height: 100,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    fontWeight: '500',
  },
  loaderContainer: {
    marginTop: 60,
    width: width * 0.6,
  },
  loaderBarBase: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loaderBarProgress: {
    height: '100%',
    width: '40%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  }
});

export default LoadingScreen;
