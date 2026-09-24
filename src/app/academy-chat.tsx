import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AnimatedPressable from '../components/AnimatedPressable';
import AppHeader from '../components/AppHeader';
import Screen from '../components/Screen';
import { useTranslation } from '../i18n/LanguageContext';
import {
  ChatMessage,
  Conversation,
  fetchAuthors,
  fetchConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
} from '../lib/academyChat';
import { AppColors } from '../theme/palettes';
import { useAppTheme } from '../theme/ThemeContext';
import { radius, spacing } from '../theme/layout';
import { scaleFont } from '../theme/typography';

export default function AcademyChatScreen() {
  const { conversationId, asMemberId } = useLocalSearchParams<{
    conversationId: string;
    asMemberId: string;
  }>();
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [authors, setAuthors] = useState<Record<string, { id: string; full_name: string }>>({});
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;

    const [threads, rows] = await Promise.all([
      fetchConversations(),
      fetchMessages(conversationId),
    ]);

    setConversation(threads.find((row) => row.id === conversationId) ?? null);
    setMessages(rows);
    setAuthors(await fetchAuthors([...new Set(rows.map((row) => row.sender_id))]));
    setIsLoading(false);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Opening the thread is what clears its unread count.
  useEffect(() => {
    if (!conversationId || !asMemberId) return;
    markConversationRead(asMemberId, conversationId);
  }, [conversationId, asMemberId, messages.length]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = subscribeToConversation(conversationId, (message) => {
      setMessages((current) =>
        current.some((row) => row.id === message.id) ? current : [...current, message]
      );
    });

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  // A name for a sender who was not in the thread when it was first read.
  useEffect(() => {
    const missing = [...new Set(messages.map((row) => row.sender_id))].filter((id) => !authors[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    fetchAuthors(missing).then((extra) => {
      if (!cancelled) setAuthors((current) => ({ ...current, ...extra }));
    });

    return () => {
      cancelled = true;
    };
  }, [messages, authors]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !conversationId || !asMemberId || isSending) return;

    setIsSending(true);
    setErrorMessage('');

    const { error } = await sendMessage(conversationId, asMemberId, body);
    setIsSending(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setDraft('');
    // The realtime insert echoes back, so nothing is appended here.
  }

  const title = conversation
    ? conversation.kind === 'group'
      ? conversation.title || t('academyChat.untitledGroup')
      : conversation.other_names.join(', ') || t('academyChat.unknownPerson')
    : t('academy.tabMessages');

  return (
    <Screen scroll={false} maxWidth={900} contentStyle={styles.content}>
      <AppHeader
        title={title}
        subtitle={
          conversation && conversation.kind === 'group'
            ? conversation.other_names.join(', ')
            : undefined
        }
      />

      {isLoading ? (
        <ActivityIndicator color={colors.greenLight} style={styles.loading} />
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.thread}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="chatbubbles-outline" size={26} color={colors.greyDark} />
                <Text style={styles.emptyText}>{t('academyChat.sayHello')}</Text>
              </View>
            ) : (
              messages.map((message) => {
                const isMine = message.sender_id === asMemberId;
                const author = authors[message.sender_id];

                return (
                  <View
                    key={message.id}
                    style={[styles.bubbleRow, isMine ? styles.bubbleRowMine : null]}
                  >
                    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      {!isMine ? (
                        <Text style={styles.bubbleAuthor}>
                          {author?.full_name ?? t('academyChat.unknownPerson')}
                        </Text>
                      ) : null}

                      <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : null]}>
                        {message.body}
                      </Text>

                      <Text style={[styles.bubbleTime, isMine ? styles.bubbleTimeMine : null]}>
                        {new Date(message.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('academyChat.messagePlaceholder')}
              placeholderTextColor={colors.greyDark}
              multiline
            />

            <AnimatedPressable
              style={[styles.sendButton, !draft.trim() && styles.sendButtonOff]}
              onPress={handleSend}
            >
              {isSending ? (
                <ActivityIndicator color={colors.blackText} size="small" />
              ) : (
                <Ionicons name="send" size={16} color={colors.blackText} />
              )}
            </AnimatedPressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: {
      paddingBottom: spacing.md,
    },
    flex: {
      flex: 1,
    },
    loading: {
      marginTop: spacing.xl,
    },
    thread: {
      paddingBottom: spacing.md,
      gap: 8,
    },
    bubbleRow: {
      flexDirection: 'row',
    },
    bubbleRowMine: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '82%',
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderWidth: 1,
    },
    bubbleTheirs: {
      backgroundColor: colors.card,
      borderColor: colors.border,
    },
    bubbleMine: {
      backgroundColor: colors.greenLight,
      borderColor: colors.borderGreen,
    },
    bubbleAuthor: {
      color: colors.greenLight,
      fontSize: scaleFont(11),
      fontWeight: '900',
      marginBottom: 3,
    },
    bubbleText: {
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '600',
      lineHeight: 19,
    },
    bubbleTextMine: {
      color: colors.blackText,
      fontWeight: '700',
    },
    bubbleTime: {
      color: colors.greyDark,
      fontSize: scaleFont(10),
      fontWeight: '700',
      marginTop: 4,
      textAlign: 'right',
    },
    bubbleTimeMine: {
      color: colors.blackText,
      opacity: 0.6,
    },
    errorText: {
      color: colors.red,
      fontSize: scaleFont(12),
      fontWeight: '700',
      marginBottom: 6,
    },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      color: colors.white,
      fontSize: scaleFont(14),
      fontWeight: '600',
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.greenLight,
    },
    sendButtonOff: {
      opacity: 0.4,
    },
    emptyBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.grey,
      fontSize: scaleFont(13),
      fontWeight: '600',
      textAlign: 'center',
    },
  });
