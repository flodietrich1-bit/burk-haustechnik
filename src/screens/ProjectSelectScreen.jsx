import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS } from '../constants/theme';
import { t, LANGUAGES } from '../locales/i18n';

export default function ProjectSelectScreen({
  monteur,
  projects = [],
  onSelectProject,
  currentLang = 'de',
  onSelectLang,
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.ink} />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View>
            <View style={styles.logoRow}>
              <Text style={styles.logoBold}>burk</Text>
              <Text style={styles.logoSmall}>Haustechnik</Text>
            </View>
            <Text style={styles.appSubtitle}>Materialtracker</Text>
          </View>

          {/* Language Switcher */}
          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.langChip, currentLang === l.code && styles.langChipActive]}
                onPress={() => onSelectLang && onSelectLang(l.code)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.langChipText,
                    currentLang === l.code && styles.langChipTextActive,
                  ]}
                >
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logged in Monteur banner */}
        <View style={styles.monteurBadge}>
          <Text style={styles.monteurIcon}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.monteurLabel}>{t('loggedInAs', currentLang)}</Text>
            <Text style={styles.monteurName}>{monteur?.name || 'Monteur'}</Text>
          </View>
          <View style={styles.projectCountBadge}>
            <Text style={styles.projectCountText}>
              {projects.length} {projects.length === 1 ? 'Projekt' : 'Projekte'}
            </Text>
          </View>
        </View>
      </View>

      {/* Projects List */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('selectProjectTitle', currentLang)}</Text>
          <Text style={styles.sectionSub}>{t('selectProjectSub', currentLang)}</Text>
        </View>

        {projects.map((proj) => (
          <TouchableOpacity
            key={proj.id}
            style={styles.projectCard}
            onPress={() => onSelectProject(proj)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeader}>
              <View style={styles.projectNumberChip}>
                <Text style={styles.projectNumberText}>
                  {proj.projectNumber ? `Nr. ${proj.projectNumber}` : 'Projekt'}
                </Text>
              </View>
              {proj.calendarWeek ? (
                <View style={styles.kwBadge}>
                  <Text style={styles.kwText}>{t('kw', currentLang)} {proj.calendarWeek}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.projectTitle}>{proj.name}</Text>

            {proj.client ? (
              <Text style={styles.clientText}>🏛️ {proj.client}</Text>
            ) : null}

            {proj.address || proj.location ? (
              <Text style={styles.locationText}>
                📍 {proj.address || proj.location}
              </Text>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.cardFooter}>
              <View style={styles.footerInfo}>
                {proj.projectManager ? (
                  <Text style={styles.pmText}>
                    👷 Bauleitung: <Text style={styles.pmBold}>{proj.projectManager}</Text>
                  </Text>
                ) : null}
                {proj.trade ? (
                  <Text style={styles.tradeText}>🔧 {proj.trade}</Text>
                ) : null}
              </View>

              <View style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>{t('openProjectBtn', currentLang)}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.ink,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  logoRow: {
    alignItems: 'flex-start',
  },
  logoBold: {
    fontSize: 24,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.amber,
    letterSpacing: -0.5,
  },
  logoSmall: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#8A9096',
    fontWeight: '700',
    marginTop: -2,
    textTransform: 'uppercase',
  },
  appSubtitle: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  langRow: {
    flexDirection: 'row',
    gap: 6,
  },
  langChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  langChipActive: {
    backgroundColor: COLORS.amber,
  },
  langChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  langChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  monteurBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  monteurIcon: {
    fontSize: 22,
  },
  monteurLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  monteurName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  projectCountBadge: {
    backgroundColor: 'rgba(59,130,196,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(59,130,196,0.4)',
  },
  projectCountText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#93C5FD',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.ink,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 13.5,
    color: COLORS.muted,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  projectNumberChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  projectNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.amberDark,
  },
  kwBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kwText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.ink,
    marginBottom: 6,
    lineHeight: 22,
  },
  clientText: {
    fontSize: 13,
    color: COLORS.inkSoft,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12.5,
    color: COLORS.muted,
    marginBottom: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerInfo: {
    flex: 1,
    gap: 2,
  },
  pmText: {
    fontSize: 11.5,
    color: COLORS.muted,
  },
  pmBold: {
    fontWeight: '700',
    color: COLORS.ink,
  },
  tradeText: {
    fontSize: 11.5,
    color: COLORS.muted,
  },
  actionBtn: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
