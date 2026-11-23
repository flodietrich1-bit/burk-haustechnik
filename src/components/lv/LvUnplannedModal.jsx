import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { COLORS } from '../../constants/theme';
import { t } from '../../locales/i18n';

const COMMON_UNITS = ['Stk', 'm', 'Pck', 'Set'];

export default function LvUnplannedModal({
  visible,
  onClose,
  onAdd,
  currentLang = 'de',
}) {
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('Stk');

  const handleAdd = () => {
    const trimmedDesc = desc.trim();
    if (!trimmedDesc) {
      Alert.alert(t('validationFillRequired', currentLang));
      return;
    }

    const parsedQty = parseFloat(qty.replace(',', '.'));
    const safeQty = isNaN(parsedQty) || parsedQty <= 0 ? 1 : Math.round(parsedQty * 100) / 100;

    onAdd({
      customDescription: trimmedDesc,
      quantity: safeQty,
      qu: unit,
    });

    // Reset fields & close
    setDesc('');
    setQty('1');
    setUnit('Stk');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('lvUnplannedModalTitle', currentLang)}</Text>
          <Text style={styles.modalSubtitle}>
            {t('unclearSubInfo', currentLang)}
          </Text>

          {/* Description input */}
          <Text style={styles.fieldLabel}>{t('lvUnplannedDescLabel', currentLang)}</Text>
          <TextInput
            style={styles.descInput}
            value={desc}
            onChangeText={setDesc}
            placeholder={t('lvUnplannedDescPlaceholder', currentLang)}
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
            autoFocus
          />

          {/* Quantity & Unit Row */}
          <Text style={styles.fieldLabel}>{t('lvUnplannedQtyLabel', currentLang)}</Text>
          <View style={styles.qtyUnitRow}>
            <TextInput
              style={styles.qtyInput}
              value={qty}
              onChangeText={setQty}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.unitChips}>
              {COMMON_UNITS.map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>{t('cancel', currentLang)}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.7}>
              <Text style={styles.addBtnText}>+ {t('lvUnplannedAddBtn', currentLang)}</Text>
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
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  descInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
    minHeight: 76,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  qtyUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  qtyInput: {
    width: 90,
    height: 46,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  unitChips: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  unitChip: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  unitChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  unitChipTextActive: {
    color: '#2563EB',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  addBtn: {
    flex: 1.6,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
