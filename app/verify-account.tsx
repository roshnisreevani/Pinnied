import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { confirmVerificationCode, sendVerificationCode } from '@/lib/verification';

export default function VerifyAccountScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const email = session?.user.email ?? '';
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<'intro' | 'code' | 'done'>('intro');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleSendCode = async () => {
    if (!email) return;
    setSending(true);
    try {
      await sendVerificationCode();
      // Requesting a new code invalidates whatever was sent before, so clear
      // any digits already typed — resubmitting a stale code here would
      // always fail as "expired or invalid" even seconds after this resend.
      setCode('');
      setStep('code');
    } catch (e) {
      Alert.alert('Could not send code', errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const confirmingRef = useRef(false);

  const handleConfirm = useCallback(
    async (codeToConfirm: string) => {
      if (!userId || codeToConfirm.length < 6 || confirmingRef.current) return;
      confirmingRef.current = true;
      Keyboard.dismiss();
      setConfirming(true);
      try {
        await confirmVerificationCode(codeToConfirm);
        setStep('done');
      } catch (e) {
        Alert.alert('Could not verify', errorMessage(e));
        setCode('');
      } finally {
        confirmingRef.current = false;
        setConfirming(false);
      }
    },
    [userId]
  );

  // Auto-submit the moment all 6 digits are in — the on-screen keyboard
  // covers the Confirm button on smaller screens, so don't make tapping it
  // the only way to finish.
  useEffect(() => {
    if (code.trim().length === 6) {
      handleConfirm(code.trim());
    }
  }, [code, handleConfirm]);

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Verify Account</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
      <View style={styles.content}>
        {step === 'intro' && (
          <>
            <ShieldCheck size={48} color={colors.coral} strokeWidth={1.75} />
            <Text style={styles.title}>Verify your account</Text>
            <Text style={styles.body}>
              Verified accounts can post Open Games — pickup games anyone nearby can discover and join, not just
              your friend group. We'll send a 6-digit code to {email || 'your email'}.
            </Text>
            <AnimatedPressable style={styles.primaryButton} onPress={handleSendCode} disabled={sending}>
              {sending ? (
                <ActivityIndicator color={ON_ACCENT} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Send Code</Text>
              )}
            </AnimatedPressable>
          </>
        )}

        {step === 'code' && (
          <>
            <ShieldCheck size={48} color={colors.coral} strokeWidth={1.75} />
            <Text style={styles.title}>Enter your code</Text>
            <Text style={styles.body}>
              Check {email} for a 6-digit code. Use the newest email — requesting a new code cancels any earlier
              one.
            </Text>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <AnimatedPressable
              style={styles.primaryButton}
              onPress={() => handleConfirm(code.trim())}
              disabled={confirming || code.trim().length < 6}>
              {confirming ? (
                <ActivityIndicator color={ON_ACCENT} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Confirm</Text>
              )}
            </AnimatedPressable>
            <AnimatedPressable onPress={handleSendCode} disabled={sending}>
              <Text style={styles.resendText}>{sending ? 'Sending…' : 'Resend code'}</Text>
            </AnimatedPressable>
          </>
        )}

        {step === 'done' && (
          <>
            <CheckCircle2 size={48} color={colors.coral} strokeWidth={1.75} />
            <Text style={styles.title}>You're verified</Text>
            <Text style={styles.body}>You can now post Open Games for people nearby to discover and join.</Text>
            <AnimatedPressable style={styles.primaryButton} onPress={() => router.back()}>
              <Text style={styles.primaryButtonText}>Done</Text>
            </AnimatedPressable>
          </>
        )}
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: WEIGHT.bold, color: colors.text },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 },
    title: { fontSize: 20, fontWeight: WEIGHT.bold, color: colors.text, textAlign: 'center' },
    body: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    codeInput: {
      width: '100%',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      paddingVertical: 14,
      fontSize: 22,
      letterSpacing: 8,
      textAlign: 'center',
      color: colors.text,
      marginTop: 6,
    },
    primaryButton: {
      width: '100%',
      backgroundColor: colors.coral,
      borderRadius: RADII.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButtonText: { color: ON_ACCENT, fontWeight: WEIGHT.semibold, fontSize: 15 },
    resendText: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  });
}
