
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors, commonStyles } from '@/styles/commonStyles';
import { StreamdownRN } from 'streamdown-rn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isOptimistic?: boolean;
}

const CONVERSATION_KEY = '@code_assistant_conversation_id';

export default function CodeAssistantScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      console.log('CodeAssistant: Loading messages for conversation:', convId);
      // TODO: Backend Integration - GET /api/code-assistant/conversations/:id/messages
      setMessages([]);
    } catch (error) {
      console.error('CodeAssistant: Error loading messages:', error);
    }
  }, []);

  const createNewConversation = useCallback(async () => {
    try {
      // TODO: Backend Integration - POST /api/code-assistant/conversations
      // Creates a new conversation for code assistance
      // Returns: { conversationId: string }
      
      // Temporary mock - will be replaced by backend integration
      const mockConversationId = `conv_${Date.now()}`;
      setConversationId(mockConversationId);
      await AsyncStorage.setItem(CONVERSATION_KEY, mockConversationId);
      
      // Add welcome message
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: '👋 Hi! I\'m your code assistant. I can help you with:\n\n- Debugging code issues\n- Explaining code concepts\n- Writing code snippets\n- Reviewing code\n- Suggesting improvements\n\nWhat would you like help with today?',
        createdAt: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    } catch (error) {
      console.error('CodeAssistant: Error creating conversation:', error);
    }
  }, []);

  const initializeConversation = useCallback(async () => {
    try {
      const savedConversationId = await AsyncStorage.getItem(CONVERSATION_KEY);
      if (savedConversationId) {
        console.log('CodeAssistant: Loading existing conversation:', savedConversationId);
        setConversationId(savedConversationId);
        await loadMessages(savedConversationId);
      } else {
        console.log('CodeAssistant: Creating new conversation');
        await createNewConversation();
      }
    } catch (error) {
      console.error('CodeAssistant: Error initializing conversation:', error);
    } finally {
      setInitialLoading(false);
    }
  }, [loadMessages, createNewConversation]);

  // Load or create conversation on mount
  useEffect(() => {
    console.log('CodeAssistant: Initializing conversation');
    initializeConversation();
  }, [initializeConversation]);

  const sendMessage = async () => {
    if (!inputText.trim() || !conversationId || loading) {
      return;
    }

    const messageText = inputText.trim();
    setInputText('');
    console.log('CodeAssistant: Sending message:', messageText);

    // Create optimistic user message
    const userMessage: Message = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    // Scroll to bottom
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // TODO: Backend Integration - POST /api/code-assistant/conversations/:id/messages
      // Body: { message: string }
      // Saves user message, sends full conversation history to OpenAI GPT-4,
      // saves and returns AI response
      // Returns: { userMessage: { id, role, content, createdAt }, assistantMessage: { id, role, content, createdAt } }
      
      // Temporary mock response - will be replaced by backend integration
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      const mockUserMessage: Message = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: messageText,
        createdAt: new Date().toISOString(),
      };

      const mockAssistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: `I received your question: "${messageText}"\n\nThis is a mock response. Once the backend is integrated with OpenAI, I'll provide real code assistance including:\n\n\`\`\`javascript\n// Example code snippets\nconst example = "formatted code";\n\`\`\`\n\nAnd detailed explanations to help you solve your coding challenges!`,
        createdAt: new Date().toISOString(),
      };

      // Replace optimistic message with real messages
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMessage.id);
        return [...filtered, mockUserMessage, mockAssistantMessage];
      });

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('CodeAssistant: Error sending message:', error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = async () => {
    console.log('CodeAssistant: Starting new conversation');
    await AsyncStorage.removeItem(CONVERSATION_KEY);
    setMessages([]);
    setConversationId(null);
    await createNewConversation();
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === 'user';
    const showTimestamp = index === 0 || 
      new Date(item.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 300000;

    const timeDisplay = formatTime(item.createdAt);

    return (
      <View style={styles.messageContainer}>
        {showTimestamp && (
          <Text style={styles.timestamp}>{timeDisplay}</Text>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          {isUser ? (
            <Text style={styles.userText}>{item.content}</Text>
          ) : (
            <StreamdownRN
              theme="light"
              style={styles.assistantText}
            >
              {item.content}
            </StreamdownRN>
          )}
        </View>
      </View>
    );
  };

  if (initialLoading) {
    return (
      <View style={commonStyles.container}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Code Assistant',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Code Assistant',
          headerBackTitle: 'Back',
          headerRight: () => (
            <TouchableOpacity
              onPress={startNewConversation}
              style={styles.newChatButton}
            >
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {messages.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyContainer}
            showsVerticalScrollIndicator={false}
          >
            <IconSymbol
              ios_icon_name="chevron.left.forwardslash.chevron.right"
              android_material_icon_name="code"
              size={64}
              color={colors.primary}
            />
            <Text style={styles.emptyTitle}>Code Assistant</Text>
            <Text style={styles.emptySubtitle}>
              Ask me anything about coding!
            </Text>
            
            <View style={styles.examplesContainer}>
              <Text style={styles.examplesTitle}>Try asking:</Text>
              <TouchableOpacity
                style={styles.exampleCard}
                onPress={() => setInputText('How do I use React hooks?')}
              >
                <Text style={styles.exampleText}>How do I use React hooks?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exampleCard}
                onPress={() => setInputText('Debug this error: Cannot read property of undefined')}
              >
                <Text style={styles.exampleText}>Debug this error: Cannot read property of undefined</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exampleCard}
                onPress={() => setInputText('Write a function to sort an array')}
              >
                <Text style={styles.exampleText}>Write a function to sort an array</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
            }}
          />
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a coding question..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={2000}
            editable={!loading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <IconSymbol
                ios_icon_name="arrow.up.circle.fill"
                android_material_icon_name="send"
                size={28}
                color={colors.card}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  newChatButton: {
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  examplesContainer: {
    width: '100%',
    maxWidth: 400,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  exampleCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exampleText: {
    fontSize: 15,
    color: colors.text,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 16,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userText: {
    fontSize: 16,
    color: colors.card,
    lineHeight: 22,
  },
  assistantText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
  },
});
