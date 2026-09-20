import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import { setupMonteurProfile } from '../services/authService';

export default function SetupProfileScreen({ onComplete, currentLang = 'de' }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert(t('setupTitle', currentLang), t('nameLabel', currentLang));
      return;
    }
    if (pin.trim().length !== 4 || !/^\d{4}$/.test(pin.trim())) {
      Alert.alert(t('setupTitle', currentLang), 'Bitte genau 4 Ziffern als PIN eingeben.');
      return;
    }

    try {
      setLoading(true);
      const monteur = await setupMonteurProfile(name.trim(), pin.trim());
      onComplete(monteur);
    } catch (err) {
      Alert.alert('Fehler', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>burk</Text>
            <Text style={styles.logoSub}>Haustechnik</Text>
          </View>

          <Text style={styles.title}>{t('setupTitle', currentLang)}</Text>
          <Text style={styles.subtitle}>{t('setupSub', currentLang)}</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('nameLabel', currentLang)}</Text>
            <TextInput
              style={styles.input}
              placeholder="z. B. Ion Popescu oder M. Kovač"
              placeholderTextColor={COLORS.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('pinLabel', currentLang)}</Text>
            <TextInput
              style={[styles.input, styles.pinInput]}
              placeholder="••••"
              placeholderTextColor={COLORS.muted}
              value={pin}
              onChangeText={(val) => setPin(val.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
            />
            <Text style={styles.hint}>4 Zahlen für den schnellen täglichen Login (auch offline)</Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{t('startApp', currentLang)}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.line,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  logoBadge: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.amber,
  },
  logoSub: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.muted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: COLORS.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: '#FAFCFE',
  },
  pinInput: {
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: COLORS.amber,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});
