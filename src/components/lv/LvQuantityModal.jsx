import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../../constants/theme';
import { t, formatUnit } from '../../locales/i18n';

export default function LvQuantityModal({
  visible,
  position,
  initialQty = 0,
  onClose,
  onApply,
  currentLang = 'de',
}) {
  const [val, setVal] = useState('');

  useEffect(() => {
    if (visible) {
      setVal(initialQty > 0 ? String(initialQty) : '');
    }
  }, [visible, initialQty]);

  if (!visible || !position) return null;

  const qu = formatUnit(position.qu || 'Stk', currentLang);
  const title = position.aliasTitle || position.officialTitle || position.shortText || '';
  const code = position.displayCode || position.posNr || '';

  const handleSave = () => {
    const parsed = parseFloat(val.replace(',', '.'));
    const safeQty = isNaN(parsed) || parsed < 0 ? 0 : Math.round(parsed * 100) / 100;
    onApply(position, safeQty);
    onClose();
  };

  const handleClear = () => {
    setVal('0');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('lvEnterQuantityTitle', currentLang)}</Text>
          <Text style={styles.posSubtitle}>
            {code ? `[${code}] ` : ''}{title}
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={val}
              onChangeText={setVal}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#94A3B8"
              autoFocus
              selectTextOnFocus
            />
            <Text style={styles.unitText}>{qu}</Text>
          </View>

          {/* Quick presets */}
          <View style={styles.presetRow}>
            {[1, 5, 10, 25].map((preset) => (
              <TouchableOpacity
                key={preset}
                style={styles.presetChip}
                onPress={() => setVal(String(preset))}
              >
                <Text style={styles.presetChipText}>{preset} {qu}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
              <Text style={styles.clearBtnText}>{t('delete', currentLang)} (0)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t('cancel', currentLang)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleSave} activeOpacity={0.7}>
              <Text style={styles.applyBtnText}>{t('confirm', currentLang)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  posSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  unitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  presetChip: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearBtn: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 14,
  },
  applyBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
