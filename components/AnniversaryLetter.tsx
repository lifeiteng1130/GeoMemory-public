import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { AnniversaryLetterContent } from '../lib/anniversary';

interface Props {
  letter: AnniversaryLetterContent;
  onClose: () => void;
}

export default function AnniversaryLetter({ letter, onClose }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const stars = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (!active) return;
      if (reduced) {
        fade.setValue(1);
        return;
      }
      animation = Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(stars, { toValue: 1, duration: 850, useNativeDriver: true }),
          Animated.delay(1700),
          Animated.timing(stars, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      ]);
      animation.start();
    }).catch(() => fade.setValue(1));
    return () => { active = false; animation?.stop(); };
  }, [fade, stars]);

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.backdrop}>
        <Animated.View style={[styles.letter, { opacity: fade }]}>
          <Animated.Text style={[styles.star, styles.starOne, { opacity: stars }]}>✦</Animated.Text>
          <Animated.Text style={[styles.star, styles.starTwo, { opacity: stars }]}>✧</Animated.Text>
          <Animated.Text style={[styles.star, styles.starThree, { opacity: stars }]}>✦</Animated.Text>
          <Text style={styles.eyebrow}>给宝宝的一封信</Text>
          <Text style={styles.heading}>{letter.heading}</Text>
          <View style={styles.divider} />
          <Text style={styles.message}>{letter.message}</Text>
          <Text style={styles.date}>10 月 12 日 · 我们的纪念日</Text>
          <TouchableOpacity style={styles.button} onPress={onClose} accessibilityRole="button" accessibilityLabel="收下这份回忆并关闭弹窗">
            <Text style={styles.buttonText}>收下这份回忆</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="关闭纪念日弹窗">
            <Text style={styles.closeText}>暂时收起</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'rgba(3, 8, 25, 0.82)' },
  backdrop: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 36 },
  letter: { overflow: 'hidden', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(241, 220, 174, 0.35)', backgroundColor: '#18223b', paddingHorizontal: 28, paddingTop: 38, paddingBottom: 26, alignItems: 'center' },
  eyebrow: { color: '#d6c6a4', fontSize: 13, letterSpacing: 3 },
  heading: { color: '#fff5e6', fontSize: 29, fontWeight: '600', marginTop: 15, letterSpacing: 6 },
  divider: { width: 42, height: 1, backgroundColor: '#bba574', marginTop: 20, marginBottom: 26 },
  message: { color: '#f5efe8', fontSize: 18, lineHeight: 32, textAlign: 'center', minHeight: 128 },
  date: { color: '#b4afad', fontSize: 12, marginTop: 17, marginBottom: 27 },
  button: { backgroundColor: '#e4ceb0', borderRadius: 24, paddingHorizontal: 26, paddingVertical: 12 },
  buttonText: { color: '#24304b', fontWeight: '600', fontSize: 15 },
  closeText: { color: '#c0b9b5', fontSize: 12, marginTop: 20 },
  star: { position: 'absolute', color: '#f4ddac', fontSize: 24 },
  starOne: { top: 20, left: 24 },
  starTwo: { top: 83, right: 24, fontSize: 18 },
  starThree: { bottom: 95, left: 33, fontSize: 13 },
});
