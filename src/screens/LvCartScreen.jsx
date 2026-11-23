import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../constants/theme';
import { t, formatUnit } from '../locales/i18n';
import { persistPhotoLocally } from '../services/storageService';
import LvUnplannedModal from '../components/lv/LvUnplannedModal';

const MAX_BYTES = 1000 * 1024; // 1000 KB

async function compressPhoto(uri) {
  let quality = 0.7;
  let result = { uri };
  for (let attempt = 0; attempt < 4; attempt++) {
    result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
    );
    try {
      const info = await FileSystem.getInfoAsync(result.uri, { size: true });
      if (!info.size || info.size <= MAX_BYTES) break;
    } catch {
      break;
    }
    quality = Math.max(0.3, quality - 0.2);
  }
  return result.uri;
}

export default function LvCartScreen({
  cart = [],
  project = {},
  monteur = {},
  currentLang = 'de',
  onBack,
  onQuantityChange,
  onRemoveItem,
  onAddUnplannedItem,
  onSubmitSection,
}) {
  const [sectionTitle, setSectionTitle] = useState('');
  const [photos, setPhotos] = useState([]); // [localUri, ...]
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unplannedModalVisible, setUnplannedModalVisible] = useState(false);

  // Take photo with camera
  const handleCameraPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('cameraAccessTitle', currentLang), t('cameraAccessMsg', currentLang));
        return;
      }

      setIsCapturing(true);
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        const compressed = await compressPhoto(result.assets[0].uri);
        const permanentUri = await persistPhotoLocally(compressed);
        setPhotos((prev) => [...prev, permanentUri]);
      }
    } catch (e) {
      console.warn('Camera capture error:', e);
      Alert.alert(t('cameraTitle', currentLang), t('cameraError', currentLang));
    } finally {
      setIsCapturing(false);
    }
  };

  // Pick photo from gallery
  const handleGalleryPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('cameraAccessTitle', currentLang), t('cameraAccessMsg', currentLang));
        return;
      }

      setIsCapturing(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length > 0) {
        for (const asset of result.assets) {
          if (asset.uri) {
            const compressed = await compressPhoto(asset.uri);
            const permanentUri = await persistPhotoLocally(compressed);
            setPhotos((prev) => [...prev, permanentUri]);
          }
        }
      }
    } catch (e) {
      console.warn('Gallery pick error:', e);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // Final submission validation
  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert(t('validationFillRequired', currentLang), t('lvValidationEmptyCart', currentLang));
      return;
    }

    const trimmedTitle = sectionTitle.trim();
    if (!trimmedTitle) {
      Alert.alert(t('validationFillRequired', currentLang), t('lvValidationMissingTitle', currentLang));
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitSection({
        sectionTitle: trimmedTitle,
        photos,
      });
    } catch (err) {
      console.error('Error submitting section:', err);
      Alert.alert('Fehler', 'Das Aufmaß konnte nicht eingereicht werden. Bitte versuche es erneut.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPositions = cart.length;

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>‹ {t('backShort', currentLang)}</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{t('lvCartTitle', currentLang)}</Text>
        <View style={styles.topCountBadge}>
          <Text style={styles.topCountText}>{totalPositions}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Section 1: Cart Items */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('lvCartItemsSection', currentLang)}</Text>
            <TouchableOpacity
              style={styles.addUnplannedBtn}
              onPress={() => setUnplannedModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addUnplannedBtnText}>{t('lvAddUnplannedBtn', currentLang)}</Text>
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCartBox}>
              <Text style={styles.emptyCartIcon}>📋</Text>
              <Text style={styles.emptyCartText}>{t('lvEmptyCart', currentLang)}</Text>
              <TouchableOpacity style={styles.backToTradesBtn} onPress={onBack}>
                <Text style={styles.backToTradesBtnText}>{t('lvBackToPositions', currentLang)}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            cart.map((item, index) => {
              const posNr = item.posNr || '';
              const title = item.shortText || item.customDescription || '';
              const qu = formatUnit(item.qu || 'Stk', currentLang);
              const isUnplanned = !!item.isUnplannedMaterial;
              const isCustomAdded = item.sourceType === 'CUSTOM_ADDED';

              return (
                <View key={item.lvItemId || index} style={styles.cartItemRow}>
                  <View style={styles.cartItemInfo}>
                    <View style={styles.itemBadgeRow}>
                      {posNr ? (
                        <View style={styles.posBadge}>
                          <Text style={styles.posBadgeText}>{posNr}</Text>
                        </View>
                      ) : null}
                      {isUnplanned && (
                        <View style={styles.unplannedBadge}>
                          <Text style={styles.unplannedBadgeText}>⚠️ Nicht im LV</Text>
                        </View>
                      )}
                      {isCustomAdded && (
                        <View style={styles.customBadge}>
                          <Text style={styles.customBadgeText}>★ {t('lvCustomAdded', currentLang)}</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.itemTitle}>{title}</Text>
                    {item.customDescription && !isUnplanned ? (
                      <Text style={styles.itemDesc}>{item.customDescription}</Text>
                    ) : null}
                  </View>

                  {/* Quantity Stepper & Delete Button */}
                  <View style={styles.itemActionCol}>
                    <View style={styles.stepperPill}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => onQuantityChange(item, Math.max(0, (Number(item.quantity) || 0) - 1))}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.stepperBtnText}>−</Text>
                      </TouchableOpacity>

                      <View style={styles.stepperValCenter}>
                        <Text style={styles.stepperValText}>{item.quantity}</Text>
                        <Text style={styles.stepperUnitText}>{qu}</Text>
                      </View>

                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => onQuantityChange(item, (Number(item.quantity) || 0) + 1)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={styles.stepperBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => onRemoveItem(item.lvItemId)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Section 2: Section Title (Pflichtfeld) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('lvSectionTitleLabel', currentLang)}</Text>
          <Text style={styles.fieldHint}>
            Eindeutige Bezeichnung des Bauabschnitts oder der Kalenderwoche.
          </Text>
          <TextInput
            style={[styles.textInput, !sectionTitle.trim() && cart.length > 0 && styles.inputWarning]}
            value={sectionTitle}
            onChangeText={setSectionTitle}
            placeholder={t('lvSectionTitlePlaceholder', currentLang)}
            placeholderTextColor="#94A3B8"
          />
        </View>

        {/* Section 3: Photo Documentation */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t('lvPhotosSection', currentLang)}</Text>
          <Text style={styles.fieldHint}>
            Füge Nachweisfotos vom Montageort oder den eingebauten Teilen hinzu.
          </Text>

          <View style={styles.photoActionsRow}>
            <TouchableOpacity
              style={styles.photoBtn}
              onPress={handleCameraPhoto}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <Text style={styles.photoBtnText}>{t('lvAddPhotoCamera', currentLang)}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoBtnSecondary}
              onPress={handleGalleryPhoto}
              disabled={isCapturing}
              activeOpacity={0.7}
            >
              <Text style={styles.photoBtnSecondaryText}>{t('lvAddPhotoGallery', currentLang)}</Text>
            </TouchableOpacity>
          </View>

          {isCapturing && (
            <View style={styles.capturingIndicator}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.capturingText}>Foto wird verarbeitet...</Text>
            </View>
          )}

          {/* Photos Grid */}
          {photos.length > 0 && (
            <View style={styles.photoGrid}>
              {photos.map((uri, idx) => (
                <View key={idx} style={styles.photoThumbWrapper}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => handleRemovePhoto(idx)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Text style={styles.removePhotoText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Section 4: Final Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (cart.length === 0 || !sectionTitle.trim() || isSubmitting) && styles.submitBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={cart.length === 0 || !sectionTitle.trim() || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <View style={styles.submittingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.submitBtnText}>{t('lvSubmitting', currentLang)}</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>✓ {t('lvSubmitBtn', currentLang)}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Unplanned Modal */}
      <LvUnplannedModal
        visible={unplannedModalVisible}
        onClose={() => setUnplannedModalVisible(false)}
        onAdd={onAddUnplannedItem}
        currentLang={currentLang}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  topCountBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  topCountText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  addUnplannedBtn: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  addUnplannedBtnText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCartBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyCartIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyCartText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  backToTradesBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backToTradesBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
  },
  cartItemInfo: {
    flex: 1,
  },
  itemBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  posBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  posBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  unplannedBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unplannedBadgeText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
  },
  customBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  customBadgeText: {
    color: '#2563EB',
    fontSize: 10,
    fontWeight: '700',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  itemDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  itemActionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 38,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 34,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepperValCenter: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  stepperUnitText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
    marginTop: -2,
  },
  deleteBtn: {
    padding: 6,
  },
  deleteIcon: {
    fontSize: 18,
  },
  fieldHint: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
    marginTop: 2,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
  },
  inputWarning: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  photoBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  photoBtnSecondary: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  photoBtnSecondaryText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  capturingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  capturingText: {
    fontSize: 12,
    color: '#64748B',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  photoThumbWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  submitBtn: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
