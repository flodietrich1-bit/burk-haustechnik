import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { COLORS } from '../constants/theme';
import { t } from '../locales/i18n';
import { persistPhotoLocally } from '../services/storageService';

const MAX_BYTES = 1000 * 1024; // 1000 KB

/**
 * Compress a photo URI until it is under MAX_BYTES (1000 KB).
 */
async function compressToUnder1MB(uri) {
  let quality = 0.7;
  let resize = null;
  let result = { uri };

  for (let attempt = 0; attempt < 6; attempt++) {
    const actions = resize ? [{ resize }] : [];
    result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    try {
      const info = await FileSystem.getInfoAsync(result.uri, { size: true });
      if (!info.size || info.size <= MAX_BYTES) break;
    } catch {
      break;
    }

    if (attempt < 3) {
      quality = Math.max(0.2, quality - 0.15);
    } else {
      quality = 0.3;
      resize = resize
        ? { width: Math.round((resize.width || 1280) * 0.7) }
        : { width: 900 };
    }
  }

  return result.uri;
}

export default function PhotoCaptureScreen({
  room,
  photos = [],
  onAddPhoto,
  onRemovePhoto,
  onSavePhotos,
  onBackToBook,
  currentLang = 'de',
  isSaving = false,
  isLocked = false,
}) {
  const [previewUri, setPreviewUri] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const effectiveIsLocked = isLocked || Boolean(room?.isCompleted || room?.status === 'completed');

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const handleLaunchCamera = async () => {
    if (effectiveIsLocked) {
      Alert.alert(
        t('roomLockedAlertTitle', currentLang) || 'Raum bereits fertiggestellt',
        t('roomLockedAlertMsg', currentLang) || 'Dieser Raum wurde bereits fertiggestellt. Änderungen sind gesperrt und können nur durch den Bauleiter im Admin-Bereich freigeschaltet werden.'
      );
      return;
    }
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        Alert.alert('Kamerazugriff', 'Kamerazugriff wird benötigt, um Baustellenfotos aufzunehmen.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setIsProcessing(true);
        const compressedUri = await compressToUnder1MB(result.assets[0].uri);
        const permanentUri = await persistPhotoLocally(compressedUri);
        onAddPhoto(permanentUri);
      }
    } catch (e) {
      console.warn('Camera error:', e);
      Alert.alert('Kamera', 'Foto konnte nicht aufgenommen werden.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLaunchLibrary = async () => {
    if (effectiveIsLocked) {
      Alert.alert(
        t('roomLockedAlertTitle', currentLang) || 'Raum bereits fertiggestellt',
        t('roomLockedAlertMsg', currentLang) || 'Dieser Raum wurde bereits fertiggestellt. Änderungen sind gesperrt und können nur durch den Bauleiter im Admin-Bereich freigeschaltet werden.'
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setIsProcessing(true);
        for (const asset of result.assets) {
          if (asset.uri) {
            const compressedUri = await compressToUnder1MB(asset.uri);
            const permanentUri = await persistPhotoLocally(compressedUri);
            onAddPhoto(permanentUri);
          }
        }
      }
    } catch (e) {
      console.warn('Image library error:', e);
      Alert.alert('Galerie', 'Fotos konnten nicht geladen werden.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = () => {
    if (onSavePhotos) {
      onSavePhotos(photos);
    } else if (onBackToBook) {
      onBackToBook();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={onBackToBook}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.backBtnText}>‹ {t('backShort', currentLang) || 'Zurück'}</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>📸 {t('photoTitle', currentLang) || 'Fotodokumentation'}</Text>
            <Text style={styles.headerRoom} numberOfLines={1}>{room?.name || 'Raum'}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Locked Room Status Banner */}
          {effectiveIsLocked && (
            <View style={styles.roomLockedBanner}>
              <Text style={styles.roomLockedIcon}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomLockedTitle}>{t('roomLockedBanner', currentLang)}</Text>
                <Text style={styles.roomLockedSub}>{t('roomLockedBannerSub', currentLang)}</Text>
              </View>
            </View>
          )}

          {/* Quick Action Cards: Camera & Gallery */}
          <View style={styles.actionCardsRow}>
            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardPrimary, effectiveIsLocked && styles.actionCardDisabled]}
              onPress={handleLaunchCamera}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconBoxPrimary}>
                <Text style={styles.actionIcon}>📷</Text>
              </View>
              <Text style={styles.actionCardTitle}>Kamera öffnen</Text>
              <Text style={styles.actionCardSub}>Foto aufnehmen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, styles.actionCardSecondary, effectiveIsLocked && styles.actionCardDisabled]}
              onPress={handleLaunchLibrary}
              activeOpacity={0.8}
            >
              <View style={styles.actionIconBoxSecondary}>
                <Text style={styles.actionIcon}>🖼️</Text>
              </View>
              <Text style={styles.actionCardTitle}>Aus Galerie</Text>
              <Text style={styles.actionCardSub}>Bilder auswählen</Text>
            </TouchableOpacity>
          </View>

          {isProcessing && (
            <View style={styles.processingBanner}>
              <ActivityIndicator size="small" color={COLORS.amber} />
              <Text style={styles.processingText}>Foto wird optimiert (&lt; 1000 KB)...</Text>
            </View>
          )}

          {/* Status / Instruction Banner */}
          {photos.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <View style={styles.emptyStateIconCircle}>
                <Text style={styles.emptyStateEmoji}>📸</Text>
              </View>
              <Text style={styles.emptyStateTitle}>Noch keine Fotos hinterlegt</Text>
              <Text style={styles.emptyStateDesc}>
                Für die Abnahme («Monteur fertig») ist mindestens 1 Foto der Montagearbeiten erforderlich.
              </Text>
            </View>
          ) : (
            <View style={styles.readyBanner}>
              <Text style={styles.readyBannerIcon}>✓</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.readyBannerTitle}>
                  {photos.length} {photos.length === 1 ? 'Foto' : 'Fotos'} hinterlegt
                </Text>
                <Text style={styles.readyBannerSub}>
                  Bereit für die Abnahme durch die Bauleitung.
                </Text>
              </View>
            </View>
          )}

          {/* Photo Gallery Grid */}
          {photos.length > 0 && (
            <View style={styles.gallerySection}>
              <Text style={styles.galleryHeading}>Aufgenommene Fotos ({photos.length})</Text>
              <View style={styles.grid}>
                {photos.map((uri, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoCard}
                    activeOpacity={0.9}
                    onPress={() => setPreviewUri(uri)}
                  >
                    <Image source={{ uri }} style={styles.photoImg} />
                    <View style={styles.photoBadgeRow}>
                      <View style={styles.photoBadge}>
                        <Text style={styles.photoBadgeText}>Foto {index + 1}</Text>
                      </View>
                      {!effectiveIsLocked && (
                        <TouchableOpacity
                          style={styles.deleteCircle}
                          onPress={() => onRemovePhoto(index)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.deleteCircleText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Footer Action Button */}
        <View style={styles.footer}>
          {effectiveIsLocked ? (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={onBackToBook}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>
                ‹ {t('backShort', currentLang) || 'Zurück zum Raum'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>
                {isSaving ? 'Speichere...' : '💾 Fotos speichern'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Fullscreen Photo Preview Modal */}
        <Modal visible={!!previewUri} transparent animationType="fade">
          <View style={styles.previewBackdrop}>
            <SafeAreaView style={styles.previewSafe}>
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => setPreviewUri(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.previewCloseText}>✕ Schließen</Text>
              </TouchableOpacity>
              {previewUri && (
                <Image
                  source={{ uri: previewUri }}
                  style={styles.previewFullImg}
                  resizeMode="contain"
                />
              )}
            </SafeAreaView>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ink,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.ink,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  backBtn: {
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.amber,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerRoom: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A0AEC0',
    marginTop: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 100,
  },
  actionCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  actionCardPrimary: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
  },
  actionCardSecondary: {
    backgroundColor: '#1E293B',
    borderColor: '#64748B',
  },
  actionIconBoxPrimary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIconBoxSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  actionCardSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  processingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2D3748',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  processingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.amber,
  },
  emptyStateBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  emptyStateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyStateEmoji: {
    fontSize: 32,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  readyBannerIcon: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
  },
  readyBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
  },
  readyBannerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 1,
  },
  gallerySection: {
    marginTop: 4,
  },
  galleryHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: '48%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoBadgeRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  photoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  deleteCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCircleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  saveBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  previewSafe: {
    flex: 1,
  },
  previewCloseBtn: {
    alignSelf: 'flex-end',
    padding: 16,
  },
  previewCloseText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  previewFullImg: {
    flex: 1,
    width: '100%',
  },
});
